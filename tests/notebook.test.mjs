// Notebook + auth unit tests: npm test   (no network, no database)
import { test } from "node:test";
import assert from "node:assert/strict";
import CFB from "cfb";
import { strToU8, zipSync } from "fflate";

delete process.env.GEMINI_API_KEY;
process.env.ALLOWED_EMAIL_DOMAIN = "psgtech.ac.in";

const { isAllowedEmail, allowedDomain } = await import("../app/lib/auth/domain.js");
const { LIMITS, NotebookError, detectType, extractSections, sanitizeFilename } = await import("../app/lib/notebook/extract.js");
const { chunkSections, locationLabel } = await import("../app/lib/notebook/chunk.js");
const { buildChat, buildChunks, extractiveAnswer, notFound, retrievalQuery } = await import("../app/lib/notebook/rag.js");
const { runTool } = await import("../app/lib/notebook/tools.js");
const { quizStats, subjectDigest } = await import("../app/lib/digest.js");

// ---------- fixtures ----------
/** A real, minimal multi-page PDF with correct xref offsets. */
function makePdf(pages) {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", null, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const kids = [];
  for (const text of pages) {
    const stream = `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, "\\$&")}) Tj ET`;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const contentRef = objects.length;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentRef} 0 R >>`);
    kids.push(`${objects.length} 0 R`);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

const makePptx = (slides) =>
  zipSync(Object.fromEntries(slides.map((lines, i) => [
    `ppt/slides/slide${i + 1}.xml`,
    strToU8(`<p:sld><p:cSld><p:spTree>${lines.map((l) => `<a:p><a:r><a:t>${l.replace(/&/g, "&amp;")}</a:t></a:r></a:p>`).join("")}</p:spTree></p:cSld></p:sld>`),
  ])));

const makeDocx = (paragraphs) =>
  zipSync({
    "word/document.xml": strToU8(`<w:document><w:body>${paragraphs.map(([style, text]) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`),
  });

/** A legacy .ppt compound file: SlideListWithText with SlidePersistAtoms + TextCharsAtom records (the real binary layout). */
function makePpt(slides) {
  const rec = (verInst, type, body) => {
    const h = Buffer.alloc(8);
    h.writeUInt16LE(verInst, 0);
    h.writeUInt16LE(type, 2);
    h.writeUInt32LE(body.length, 4);
    return Buffer.concat([h, body]);
  };
  const atoms = slides.flatMap((lines) => [rec(0x0000, 0x03f3, Buffer.alloc(20)), ...lines.map((l) => rec(0x0000, 0x0fa0, Buffer.from(l, "utf16le")))]);
  const slideList = rec(0x000f, 0x0ff0, Buffer.concat(atoms)); // container, instance 0 = slides
  const document = rec(0x000f, 0x03e8, slideList);
  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, "/PowerPoint Document", document);
  return new Uint8Array(CFB.write(cfb, { type: "buffer" }));
}

const fakeEmbedder = {
  model: () => "test:bow",
  async embed(texts) {
    return { vectors: texts.map((t) => [t.length % 7, 1, 0]), model: "test:bow" };
  },
};

// ---------- institutional domain ----------
test("only exact @psgtech.ac.in addresses are allowed (case-insensitive)", () => {
  assert.equal(allowedDomain(), "psgtech.ac.in");
  for (const ok of ["student@psgtech.ac.in", "Student@psgtech.ac.in", "Student@PSGTECH.AC.IN", "  a.b-c@psgtech.ac.in "]) assert.equal(isAllowedEmail(ok), true, ok);
  for (const bad of ["student@gmail.com", "student@yahoo.com", "student@outlook.com", "student@othercollege.edu", "x@psgtech.ac.in.evil.com",
    "x@sub.psgtech.ac.in", "x@psgtech.edu", "x@psg.ac.in", "x@pagtech.eac.in", "a@b@psgtech.ac.in", "@psgtech.ac.in", "psgtech.ac.in", "", null, undefined, 42]) {
    assert.equal(isAllowedEmail(bad), false, String(bad));
  }
});

// ---------- validation ----------
test("filenames are sanitised", () => {
  assert.equal(sanitizeFilename("../../etc/passwd"), "passwd");
  assert.equal(sanitizeFilename("C:\\notes\\Trees <final>.pdf"), "Trees _final_.pdf");
  assert.equal(sanitizeFilename(".hidden"), "hidden");
});

test("unsupported, empty, oversized and disguised files are rejected; legacy formats accepted when genuine", () => {
  const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof NotebookError); return e.code; } return "accepted"; };
  assert.equal(code(() => detectType("virus.exe", new Uint8Array([1]))), "unsupported_type");
  assert.equal(code(() => detectType("empty.txt", new Uint8Array())), "empty_file");
  assert.equal(code(() => detectType("big.txt", new Uint8Array(LIMITS.maxBytes + 1))), "too_large");
  assert.equal(code(() => detectType("fake.pdf", strToU8("hello world"))), "malformed");
  assert.equal(code(() => detectType("fake.doc", strToU8("hello world"))), "malformed");
  assert.equal(code(() => detectType("fake.ppt", strToU8("PK not ole"))), "malformed");
  assert.equal(detectType("Trees.PDF", makePdf(["x"])), "pdf");
  assert.equal(detectType("old.ppt", makePpt([["Title"]])), "ppt");
});

// ---------- extraction ----------
test("PDF keeps page numbers", async () => {
  const sections = await extractSections("pdf", makePdf(["A binary tree has at most two children.", "An AVL tree is a self-balancing binary search tree."]));
  assert.deepEqual(sections.map((s) => s.page), [1, 2]);
  assert.match(sections[1].text, /AVL/);
});

test("PPTX and legacy PPT keep slide numbers and titles", async () => {
  const pptx = await extractSections("pptx", makePptx([["Stacks", "LIFO order."], ["Queues & Deques", "FIFO order."]]));
  assert.deepEqual(pptx.map((s) => s.slide), [1, 2]);
  assert.equal(pptx[1].section, "Queues & Deques");
  const ppt = await extractSections("ppt", makePpt([["Inheritance", "A subclass reuses fields of its parent class."], ["Polymorphism", "One interface, many implementations."]]));
  assert.deepEqual(ppt.map((s) => s.slide), [1, 2]);
  assert.equal(ppt[0].section, "Inheritance");
  assert.match(ppt[1].text, /many implementations/);
});

test("DOCX keeps sections; Markdown keeps headings; TXT reads", async () => {
  const docx = await extractSections("docx", makeDocx([["Heading1", "Normalization"], [null, "1NF removes repeating groups."], ["Heading1", "Transactions"], [null, "ACID means atomicity, consistency, isolation, durability."]]));
  assert.deepEqual(docx.map((s) => s.section), ["Normalization", "Transactions"]);
  const md = await extractSections("md", strToU8("# Hashing\nHash tables map keys to buckets.\n\n# Heaps\nA heap is a complete binary tree."));
  assert.deepEqual(md.map((s) => s.section), ["Hashing", "Heaps"]);
  assert.equal((await extractSections("txt", strToU8("\uFEFFPlain notes about graphs."))).length, 1);
});

test("empty and damaged documents give clear errors", async () => {
  await assert.rejects(extractSections("txt", strToU8("   \n  ")), (e) => e.code === "empty_document");
  await assert.rejects(extractSections("pptx", strToU8("PK not really a zip")), (e) => e.code === "malformed");
  await assert.rejects(extractSections("pdf", strToU8("%PDF-1.4 garbage")), (e) => e.code === "extract_failed");
  await assert.rejects(extractSections("doc", makePpt([["x"]])), (e) => e.code === "extract_failed");
});

// ---------- chunking + metadata ----------
test("chunks overlap, never cross pages, and carry location metadata", () => {
  const long = Array.from({ length: 40 }, (_, i) => `Sentence ${i} explains tree rotations in detail.`).join(" ");
  const chunks = chunkSections([{ page: 3, text: long }, { page: 4, text: "Short final page about heaps and priority queues." }]);
  assert.ok(chunks.length >= 3 && chunks.every((c) => c.text.length <= 1100));
  assert.ok(chunks.filter((c) => c.page === 3).length >= 2 && chunks.at(-1).page === 4);
  assert.equal(locationLabel(chunks.at(-1)), "Page 4");
  assert.equal(locationLabel({ slide: 7 }), "Slide 7");
});

test("buildChunks tags every chunk with user, subject, material, page and embedding model", async () => {
  const { rows, summary } = await buildChunks(
    { userId: "u-1", subjectId: "dsa", materialId: "m-1", type: "pdf", bytes: makePdf(["A binary tree node has at most two children.", "AVL rotations restore the balance factor.", "Heaps are complete binary trees."]) },
    fakeEmbedder,
  );
  assert.equal(rows.length, 3);
  for (const r of rows) {
    assert.equal(r.user_id, "u-1");
    assert.equal(r.subject_id, "dsa");
    assert.equal(r.material_id, "m-1");
    assert.equal(r.embedding_model, "test:bow");
    assert.match(r.embedding, /^\[.*\]$/);
  }
  assert.deepEqual(rows.map((r) => r.page), [1, 2, 3]);
  assert.deepEqual(summary, { chunk_count: 3, location_kind: "pages", location_count: 3, embedding_model: "test:bow" });
});

// ---------- chat ----------
test("chat prompt carries sources, bounded history for follow-ups, and the subject study plan", () => {
  const sources = [{ n: 1, docName: "Trees.pdf", location: "Page 2", text: "Rotations restore balance." }];
  const history = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: i === 8 ? "What is an AVL tree?" : `turn ${i}` }));
  const contents = buildChat({ question: "Explain it more simply.", history, sources, relevant: true, planner: { subject: "Data Structures", daysToExam: 4 } });
  assert.equal(contents.length, 7); // last 6 turns + the new question
  const payload = JSON.parse(contents.at(-1).parts[0].text);
  assert.equal(payload.SOURCES[0].file, "Trees.pdf");
  assert.equal(payload.STUDY_PLAN.subject, "Data Structures");
  assert.match(retrievalQuery("Explain it more simply.", history), /AVL tree/);
});

test("offline answers cite passages and use the subject-specific 'not found' message", () => {
  const sources = [{ n: 1, text: "Rotations restore balance.", score: 0.8 }, { n: 2, text: "Unrelated.", score: 0.2 }];
  const answer = extractiveAnswer(sources, true, "Data Structures");
  assert.match(answer, /\[1\]/);
  assert.doesNotMatch(answer, /\[2\]/);
  assert.equal(extractiveAnswer(sources, false, "Data Structures"), notFound("Data Structures"));
  assert.equal(notFound("Java"), "I couldn't find enough information about this in your uploaded Java materials.");
});

// ---------- study tools (offline) ----------
test("offline quiz respects the question count; flashcards and plan come from the material", async () => {
  const text = "A stack is a linear structure that follows last in first out order. A queue is a linear structure that follows first in first out order. " +
    "Recursion uses the call stack for every function call. Traversal visits every node of the structure once. A heap is a complete binary structure used for priority queues.";
  const sources = [{ n: 1, text, section: "Stacks and queues" }, { n: 2, text: `${text} Traversal and recursion appear in trees.`, section: "Trees" }];
  const quiz = (await runTool("quiz", { sources, options: { count: 3 } })).data;
  assert.ok(quiz.questions.length >= 1 && quiz.questions.length <= 3);
  for (const q of quiz.questions) assert.ok(q.options.length === 4 && q.answer >= 0 && q.answer < 4);
  assert.ok((await runTool("flashcards", { sources })).data.cards.some((c) => /What is a stack\?/i.test(c.front)));
  assert.deepEqual((await runTool("plan", { sources })).data.topics.map((t) => t.name), ["Stacks and queues", "Trees"]);
  assert.match((await runTool("simple", { sources })).data.explanation, /\[1\]/);
});

// ---------- planner integration ----------
test("quiz accuracy and the subject digest come from real stored data", () => {
  const history = [
    { status: "quiz", subjectId: "dsa", topicId: "avl", score: { correct: 2, total: 5 } },
    { status: "quiz", subjectId: "dsa", topicId: "avl", score: { correct: 4, total: 5 } },
    { status: "quiz", subjectId: "java", topicId: "inh", score: { correct: 5, total: 5 } },
    { status: "done", subjectId: "dsa", topicId: "avl", minutes: 45 },
  ];
  assert.deepEqual(quizStats(history, "dsa"), { quizzes: 2, correct: 6, total: 10, accuracy: 60 });
  assert.equal(quizStats(history, "dsa", "avl").accuracy, 60);
  assert.equal(quizStats([], "dsa").accuracy, null);
  const state = {
    history,
    plan: null,
    subjects: [{ id: "dsa", name: "Data Structures", examDate: "2026-10-10", difficulty: 4, topics: [{ id: "avl", name: "AVL Trees", confidence: 30, weight: 3, estMinutes: 120, doneMinutes: 0 }] }],
  };
  const d = subjectDigest(state, "dsa", "2026-10-06");
  assert.equal(d.daysToExam, 4);
  assert.deepEqual(d.weakTopics, ["AVL Trees"]);
  assert.equal(d.topics[0].quizAccuracy, 60);
  assert.equal(subjectDigest(state, "java", "2026-10-06"), null);
});
