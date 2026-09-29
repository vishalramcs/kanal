// Real Supabase security checks (RLS, storage policies, subject-filtered vector search, composite keys).
// Run: npm run test:security   (needs .env.local; creates temporary users and removes them afterwards)
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const tag = randomUUID().slice(0, 8);
const created = [];

/** Create a confirmed user and sign in with a one-time link (no password), returning a client that acts as them. */
async function signedIn(email) {
  const { data: u, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  created.push(u.user.id);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError) throw linkError;
  const anon = createClient(URL, PUBLISHABLE, { auth: { persistSession: false } });
  const { data: session, error: otpError } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" });
  if (otpError) throw otpError;
  const client = createClient(URL, PUBLISHABLE, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${session.session.access_token}` } } });
  return { id: u.user.id, email, client };
}

const A = await signedIn(`sec-a-${tag}@psgtech.ac.in`);
const B = await signedIn(`sec-b-${tag}@PSGTECH.AC.IN`); // case variation must also be allowed
const G = await signedIn(`sec-g-${tag}@gmail.com`);
const anon = createClient(URL, PUBLISHABLE, { auth: { persistSession: false } });

after(async () => {
  for (const u of [A, B, G]) {
    const { data } = await admin.storage.from("materials").list(`${u.id}/dsa/${u.id === A.id ? matA : "x"}`);
    if (data?.length) await admin.storage.from("materials").remove(data.map((f) => `${u.id}/dsa/${matA}/${f.name}`));
  }
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

const subject = (user, id, name) => ({ user_id: user.id, id, name, exam_date: "2026-12-01", difficulty: 3, topics: [] });
const vec = (x) => `[${[x, 1 - x, 0.5].join(",")}]`;
let matA;

test("allowed users can create their own subjects; case-insensitive domain", async () => {
  assert.equal((await A.client.from("subjects").insert([subject(A, "dsa", "Data Structures"), subject(A, "java", "Java")])).error, null);
  assert.equal((await B.client.from("subjects").insert(subject(B, "dsa", "Data Structures"))).error, null);
});

test("users cannot read, change or delete another user's subjects", async () => {
  const { data } = await B.client.from("subjects").select("user_id, id");
  assert.ok(data.every((r) => r.user_id === B.id), "B only sees B's rows");
  assert.equal((await B.client.from("subjects").select("id").eq("user_id", A.id)).data.length, 0);
  const forged = await B.client.from("subjects").insert(subject({ id: A.id }, "hack", "Hack"));
  assert.ok(forged.error, "B cannot insert rows owned by A");
  await B.client.from("subjects").update({ name: "pwned" }).eq("user_id", A.id);
  await B.client.from("subjects").delete().eq("user_id", A.id);
  const { data: still } = await admin.from("subjects").select("name").eq("user_id", A.id).order("id");
  assert.deepEqual(still.map((s) => s.name), ["Data Structures", "Java"]);
});

test("non-institutional and anonymous users are denied by the database itself", async () => {
  assert.ok((await G.client.from("subjects").insert(subject(G, "dsa", "Data Structures"))).error, "gmail user cannot write even their own row");
  assert.equal((await G.client.from("subjects").select("id")).data.length, 0);
  const anonRead = await anon.from("subjects").select("id");
  assert.ok(anonRead.error || anonRead.data.length === 0);
  assert.ok((await G.client.rpc("match_material_chunks", { p_subject_id: "dsa", p_material_ids: null, p_embedding: vec(0.5), p_model: "t", p_count: 5 })).data?.length === 0);
});

test("vector search only returns the caller's chunks from the requested subject (and material)", async () => {
  matA = randomUUID();
  const matJava = randomUUID();
  const mats = [
    { id: matA, user_id: A.id, subject_id: "dsa", filename: "Trees.pdf", file_type: "pdf", file_size: 10, storage_path: `${A.id}/dsa/${matA}/Trees.pdf`, status: "ready", embedding_model: "t" },
    { id: matJava, user_id: A.id, subject_id: "java", filename: "OOP.pdf", file_type: "pdf", file_size: 10, storage_path: `${A.id}/java/${matJava}/OOP.pdf`, status: "ready", embedding_model: "t" },
  ];
  assert.equal((await A.client.from("materials").insert(mats)).error, null);
  const chunk = (m, subjectId, content, x) => ({ user_id: A.id, subject_id: subjectId, material_id: m, chunk_index: 0, content, page: 2, embedding: vec(x), embedding_model: "t" });
  assert.equal((await A.client.from("material_chunks").insert([chunk(matA, "dsa", "AVL rotations", 0.9), chunk(matJava, "java", "Inheritance", 0.1)])).error, null);

  const search = (client, subjectId, materialIds = null) => client.rpc("match_material_chunks", { p_subject_id: subjectId, p_material_ids: materialIds, p_embedding: vec(0.1), p_model: "t", p_count: 10 });
  assert.deepEqual((await search(A.client, "dsa")).data.map((r) => r.filename), ["Trees.pdf"], "DSA notebook never sees OOP.pdf");
  assert.deepEqual((await search(A.client, "java")).data.map((r) => r.filename), ["OOP.pdf"], "Java notebook never sees Trees.pdf");
  assert.equal((await search(A.client, "dsa", [matJava])).data.length, 0, "a Java material id can't be pulled into DSA");
  assert.equal((await search(B.client, "dsa")).data.length, 0, "B's DSA notebook never sees A's chunks");
  assert.equal((await B.client.from("material_chunks").select("id")).data.length, 0);
});

test("a chunk cannot point at a material from another subject (composite foreign key)", async () => {
  const bad = await A.client.from("material_chunks").insert({ user_id: A.id, subject_id: "java", material_id: matA, chunk_index: 1, content: "x", embedding: vec(0.5), embedding_model: "t" });
  assert.ok(bad.error, "Trees.pdf chunk can't be filed under Java");
});

test("storage: users can only touch files inside their own folder", async () => {
  const path = `${A.id}/dsa/${matA}/Trees.pdf`;
  assert.equal((await A.client.storage.from("materials").upload(path, new Blob(["%PDF-1.4 test"]), { contentType: "application/pdf" })).error, null);
  assert.ok((await A.client.storage.from("materials").download(path)).data, "owner can read");
  assert.ok((await B.client.storage.from("materials").download(path)).error, "B can't read A's file");
  assert.ok((await B.client.storage.from("materials").createSignedUrl(path, 60)).error, "B can't sign a link to A's file");
  assert.ok((await B.client.storage.from("materials").upload(`${A.id}/dsa/evil.txt`, new Blob(["x"]))).error, "B can't write into A's folder");
  assert.ok((await G.client.storage.from("materials").upload(`${G.id}/dsa/x.txt`, new Blob(["x"]))).error, "gmail user can't upload at all");
  assert.ok((await anon.storage.from("materials").download(path)).error, "anonymous can't read");
  const removed = await B.client.storage.from("materials").remove([path]);
  assert.ok(!removed.data?.length, "B can't delete A's file");
});

test("deleting a subject cascades to its materials and chunks", async () => {
  await A.client.from("subjects").delete().eq("user_id", A.id).eq("id", "java");
  const { data } = await admin.from("materials").select("filename").eq("user_id", A.id);
  assert.deepEqual(data.map((m) => m.filename), ["Trees.pdf"]);
  assert.equal((await admin.from("material_chunks").select("id").eq("user_id", A.id).eq("subject_id", "java")).data.length, 0);
});
