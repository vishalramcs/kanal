// Upload validation + text extraction. Server only.
// Returns "sections": [{ text, page?, slide?, section? }] so every chunk can cite where it came from.
import CFB from "cfb";
import { unzipSync, strFromU8 } from "fflate";
import { extractText, getDocumentProxy } from "unpdf";
import WordExtractor from "word-extractor";

export const LIMITS = { maxBytes: 10 * 1024 * 1024, maxUnzippedBytes: 60 * 1024 * 1024, maxMaterials: 30, maxChunks: 800 };

const TYPES = { pdf: "pdf", pptx: "pptx", ppt: "ppt", docx: "docx", doc: "doc", txt: "txt", md: "md", markdown: "md" };
export const MIME = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  txt: "text/plain",
  md: "text/markdown",
};
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // old Office (.doc/.ppt) compound file

/** A user-facing error: `code` for the UI, `message` safe to show, never a stack trace. */
export class NotebookError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Keep a safe display name: no paths, no control or odd characters, bounded length. */
export function sanitizeFilename(name) {
  const base = String(name || "document").split(/[\\/]/).pop();
  const clean = base.replace(/[^\w.\- ()]+/g, "_").replace(/^\.+/, "").slice(0, 100);
  return clean || "document";
}

/** Decide the type from the extension, then confirm it from the file's first bytes (magic numbers). */
export function detectType(filename, bytes) {
  const ext = filename.toLowerCase().split(".").pop();
  const type = TYPES[ext];
  if (!type) throw new NotebookError("unsupported_type", "Unsupported file type. Upload PDF, PPT, PPTX, DOC, DOCX, TXT or Markdown.");
  if (bytes.length === 0) throw new NotebookError("empty_file", "That file is empty.");
  if (bytes.length > LIMITS.maxBytes) throw new NotebookError("too_large", "That file is larger than 10 MB.", 413);
  const head = strFromU8(bytes.subarray(0, 5), true);
  if (type === "pdf" && !head.startsWith("%PDF")) throw new NotebookError("malformed", "That doesn't look like a valid PDF.");
  if ((type === "pptx" || type === "docx") && !head.startsWith("PK")) throw new NotebookError("malformed", `That doesn't look like a valid .${type} file.`);
  if ((type === "ppt" || type === "doc") && !OLE_MAGIC.every((b, i) => bytes[i] === b)) throw new NotebookError("malformed", `That doesn't look like a valid .${type} file.`);
  if ((type === "txt" || type === "md") && bytes.subarray(0, 4096).includes(0)) throw new NotebookError("malformed", "That text file contains binary data.");
  return type;
}

/** Normalise whitespace, join words hyphenated across lines, drop control characters. */
export function cleanText(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const decodeXml = (s) =>
  s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

/** Unzip only the entries we need, refusing zip bombs. */
function unzipEntries(bytes, wanted) {
  let total = 0;
  try {
    return unzipSync(bytes, {
      filter: (f) => {
        if (!wanted(f.name)) return false;
        total += f.originalSize;
        if (total > LIMITS.maxUnzippedBytes) throw new NotebookError("too_large", "That file expands to too much data.", 413);
        return true;
      },
    });
  } catch (err) {
    if (err instanceof NotebookError) throw err;
    throw new NotebookError("malformed", "That file looks damaged and couldn't be opened.");
  }
}

async function fromPdf(bytes) {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: false });
    return text.map((t, i) => ({ page: i + 1, text: t }));
  } catch {
    throw new NotebookError("extract_failed", "Couldn't read text from that PDF. If it's a scanned image, it has no selectable text.");
  }
}

function fromPptx(bytes) {
  const files = unzipEntries(bytes, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const slides = Object.keys(files).sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]));
  if (!slides.length) throw new NotebookError("malformed", "No slides were found in that presentation.");
  return slides.map((name) => {
    const xml = strFromU8(files[name]);
    const paragraphs = [...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)]
      .map((p) => [...p[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => decodeXml(t[1])).join(""))
      .filter((t) => t.trim());
    return { slide: Number(name.match(/(\d+)\.xml$/)[1]), section: paragraphs[0]?.slice(0, 80), text: paragraphs.join("\n") };
  });
}

function fromDocx(bytes) {
  const files = unzipEntries(bytes, (n) => n === "word/document.xml");
  const xml = files["word/document.xml"];
  if (!xml) throw new NotebookError("malformed", "That .docx file has no document body.");
  const sections = [];
  let current = { section: undefined, text: "" };
  for (const p of strFromU8(xml).matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const text = [...p[0].matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>/g)].map((m) => (m[1] === undefined ? "\t" : decodeXml(m[1]))).join("");
    if (!text.trim()) continue;
    if (/<w:pStyle w:val="(Heading\d|Title)"/.test(p[0])) {
      if (current.text.trim()) sections.push(current);
      current = { section: text.trim().slice(0, 80), text: `${text}\n` };
    } else current.text += `${text}\n`;
  }
  if (current.text.trim()) sections.push(current);
  return sections;
}

function fromMarkdown(text) {
  const sections = [];
  let current = { section: undefined, text: "" };
  for (const line of text.split("\n")) {
    const heading = line.match(/^#{1,6}\s+(.*)/);
    if (heading) {
      if (current.text.trim()) sections.push(current);
      current = { section: heading[1].trim().slice(0, 80), text: `${heading[1]}\n` };
    } else current.text += `${line}\n`;
  }
  if (current.text.trim()) sections.push(current);
  return sections;
}

/**
 * Legacy PowerPoint (.ppt): walk the "PowerPoint Document" record stream. Text lives in TextCharsAtom (UTF-16) and
 * TextBytesAtom (Latin-1) records; a new slide starts at each SlidePersistAtom inside the slide list, or at each Slide container.
 */
function fromPpt(bytes) {
  let entry;
  try {
    entry = CFB.find(CFB.read(Buffer.from(bytes), { type: "buffer" }), "PowerPoint Document");
  } catch {
    throw new NotebookError("malformed", "That .ppt file looks damaged and couldn't be opened.");
  }
  if (!entry?.content) throw new NotebookError("malformed", "No slides were found in that presentation.");
  const buf = Buffer.from(entry.content);
  // Slide text can live in the slide list (placeholders) and/or in each Slide's drawing (text boxes).
  // Collect both, in order, then merge by slide position so each slide is counted once.
  const listed = [];
  const drawn = [];
  const walk = (start, end, target) => {
    for (let off = start; off + 8 <= end; ) {
      const verInst = buf.readUInt16LE(off);
      const type = buf.readUInt16LE(off + 2);
      const len = buf.readUInt32LE(off + 4);
      const body = off + 8;
      if (body + len > end) break;
      if ((verInst & 0x0f) === 0x0f) {
        if (type === 0x03ee) { drawn.push([]); walk(body, body + len, drawn); } // Slide container
        else if (type === 0x0ff0) walk(body, body + len, verInst >> 4 === 0 ? listed : null); // SlideListWithText: instance 0 = slides
        else walk(body, body + len, target);
      } else if (type === 0x03f3 && target === listed) {
        listed.push([]); // SlidePersistAtom: the next slide's text follows
      } else if ((type === 0x0fa0 || type === 0x0fa8) && target?.length) {
        const text = (type === 0x0fa0 ? buf.toString("utf16le", body, body + len) : buf.toString("latin1", body, body + len)).replace(/\r/g, "\n").trim();
        if (text) target.at(-1).push(text);
      }
      off = body + len;
    }
  };
  walk(0, buf.length, null);
  const count = Math.max(listed.length, drawn.length);
  const slides = Array.from({ length: count }, (_, i) => [...new Set([...(listed[i] || []), ...(drawn[i] || [])])])
    .map((lines, i) => ({ slide: i + 1, lines }))
    .filter((s) => s.lines.length);
  if (!slides.length) throw new NotebookError("empty_document", "No readable text was found in that presentation.");
  return slides.map((s) => ({ slide: s.slide, section: s.lines[0].split("\n")[0].slice(0, 80), text: s.lines.join("\n") }));
}

/** Legacy Word (.doc): body text via word-extractor; paragraphs become sections for citations. */
async function fromDoc(bytes) {
  try {
    const doc = await new WordExtractor().extract(Buffer.from(bytes));
    return [{ text: doc.getBody() }];
  } catch {
    throw new NotebookError("extract_failed", "Couldn't read text from that .doc file. Try saving it as .docx.");
  }
}

/** Extract + clean. Throws NotebookError("empty_document") if nothing readable is left. */
export async function extractSections(type, bytes) {
  let sections;
  if (type === "pdf") sections = await fromPdf(bytes);
  else if (type === "pptx") sections = fromPptx(bytes);
  else if (type === "ppt") sections = fromPpt(bytes);
  else if (type === "docx") sections = fromDocx(bytes);
  else if (type === "doc") sections = await fromDoc(bytes);
  else {
    const text = strFromU8(bytes).replace(/^﻿/, "");
    sections = type === "md" ? fromMarkdown(text) : [{ text }];
  }
  const cleaned = sections.map((s) => ({ ...s, text: cleanText(s.text) })).filter((s) => s.text.length > 0);
  if (!cleaned.length || cleaned.reduce((a, s) => a + s.text.length, 0) < 20) {
    throw new NotebookError("empty_document", "No readable text was found in that file.");
  }
  return cleaned;
}
