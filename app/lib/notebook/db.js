// Notebook data access (Supabase). Server only. Every function takes the *user's* Supabase client,
// so Row Level Security applies to every query; the explicit user_id/subject_id filters are a second guard.

const BUCKET = "materials";

export const storagePath = (userId, subjectId, materialId, filename) => `${userId}/${subjectId}/${materialId}/${filename}`;

export const isUuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const uuidList = (v) => (Array.isArray(v) ? v.filter(isUuid).slice(0, 30) : []);

// ---------- planner (read on the server so AI context never depends on what the browser sends) ----------
export async function loadPlanner(sb, userId) {
  const [subjects, planner] = await Promise.all([
    sb.from("subjects").select("id, name, color, exam_date, difficulty, topics").eq("user_id", userId).order("position"),
    sb.from("planner_state").select("data").eq("user_id", userId).maybeSingle(),
  ]);
  if (subjects.error) throw subjects.error;
  if (planner.error) throw planner.error;
  return {
    ...(planner.data?.data || {}),
    history: planner.data?.data?.history || [],
    subjects: subjects.data.map((r) => ({ id: r.id, name: r.name, color: r.color, examDate: r.exam_date, difficulty: r.difficulty, topics: r.topics })),
  };
}

// ---------- subjects ----------
/** Delete a subject and everything under it: stored files first, then the row (materials/chunks/chats cascade). */
export async function removeSubject(sb, userId, subjectId) {
  const { data: files } = await sb.from("materials").select("storage_path").eq("user_id", userId).eq("subject_id", subjectId);
  if (files?.length) await sb.storage.from(BUCKET).remove(files.map((f) => f.storage_path));
  const { error } = await sb.from("subjects").delete().eq("user_id", userId).eq("id", subjectId);
  if (error) throw error;
}

// ---------- materials ----------
const MATERIAL_COLUMNS = "id, subject_id, filename, file_type, mime_type, file_size, status, error, location_kind, location_count, chunk_count, created_at, updated_at";

export async function listMaterials(sb, userId, subjectId) {
  const { data, error } = await sb.from("materials").select(MATERIAL_COLUMNS).eq("user_id", userId).eq("subject_id", subjectId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMaterial(sb, userId, subjectId, materialId) {
  const { data, error } = await sb.from("materials").select(`${MATERIAL_COLUMNS}, storage_path`).eq("user_id", userId).eq("subject_id", subjectId).eq("id", materialId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createMaterial(sb, row) {
  const { data, error } = await sb.from("materials").insert(row).select(MATERIAL_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function updateMaterial(sb, userId, materialId, patch) {
  const { error } = await sb.from("materials").update({ ...patch, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("id", materialId);
  if (error) throw error;
}

export async function deleteMaterial(sb, userId, subjectId, materialId) {
  const material = await getMaterial(sb, userId, subjectId, materialId);
  if (!material) return false;
  await sb.storage.from(BUCKET).remove([material.storage_path]);
  const { error } = await sb.from("materials").delete().eq("user_id", userId).eq("id", materialId);
  if (error) throw error;
  return true;
}

export async function uploadFile(sb, path, bytes, contentType) {
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
}

export async function downloadFile(sb, path) {
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

/** Short-lived link to the user's own file (Storage policies also check ownership). */
export async function signedUrl(sb, path, seconds = 120) {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}

// ---------- chunks ----------
export async function insertChunks(sb, rows) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from("material_chunks").insert(rows.slice(i, i + 200));
    if (error) throw error;
  }
}

export async function deleteChunks(sb, userId, materialId) {
  const { error } = await sb.from("material_chunks").delete().eq("user_id", userId).eq("material_id", materialId);
  if (error) throw error;
}

/** Ready materials of this subject whose vectors came from a different embedding model than the current one. */
export async function staleMaterials(sb, userId, subjectId, model) {
  const { data, error } = await sb.from("materials").select("id").eq("user_id", userId).eq("subject_id", subjectId).eq("status", "ready").neq("embedding_model", model);
  if (error) throw error;
  return data.map((m) => m.id);
}

export async function chunksOf(sb, userId, subjectId, materialIds, limit = 1000) {
  let q = sb.from("material_chunks").select("id, material_id, chunk_index, content, page, slide, section").eq("user_id", userId).eq("subject_id", subjectId);
  if (materialIds?.length) q = q.in("material_id", materialIds);
  const { data, error } = await q.order("material_id").order("chunk_index").limit(limit);
  if (error) throw error;
  return data;
}

export async function setChunkEmbeddings(sb, userId, updates, model) {
  for (let i = 0; i < updates.length; i += 20) {
    const results = await Promise.all(
      updates.slice(i, i + 20).map(({ id, embedding }) => sb.from("material_chunks").update({ embedding, embedding_model: model }).eq("user_id", userId).eq("id", id)),
    );
    const failed = results.find((r) => r.error);
    if (failed) throw failed.error;
  }
}

/** Subject-filtered vector search (SQL function: user = auth.uid(), subject, optional materials, same embedding model). */
export async function matchChunks(sb, { subjectId, materialIds, embedding, model, k }) {
  const { data, error } = await sb.rpc("match_material_chunks", {
    p_subject_id: subjectId,
    p_material_ids: materialIds?.length ? materialIds : null,
    p_embedding: embedding,
    p_model: model,
    p_count: k,
  });
  if (error) throw error;
  return data;
}

// ---------- conversations ----------
export async function listConversations(sb, userId, subjectId) {
  const { data, error } = await sb.from("notebook_conversations").select("id, title, updated_at").eq("user_id", userId).eq("subject_id", subjectId).order("updated_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data;
}

export async function countConversations(sb, userId, subjectId) {
  const { count, error } = await sb.from("notebook_conversations").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("subject_id", subjectId);
  if (error) throw error;
  return count || 0;
}

export async function getConversation(sb, userId, subjectId, id) {
  const { data, error } = await sb.from("notebook_conversations").select("id, title, updated_at").eq("user_id", userId).eq("subject_id", subjectId).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const msgs = await sb.from("notebook_messages").select("role, content, sources, mode, relevant, created_at").eq("user_id", userId).eq("conversation_id", id).order("id");
  if (msgs.error) throw msgs.error;
  return { ...data, messages: msgs.data.map((m) => ({ role: m.role, text: m.content, sources: m.sources, mode: m.mode, relevant: m.relevant })) };
}

export async function createConversation(sb, userId, subjectId, title) {
  const { data, error } = await sb.from("notebook_conversations").insert({ user_id: userId, subject_id: subjectId, title }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function addMessages(sb, userId, subjectId, conversationId, messages) {
  const { error } = await sb.from("notebook_messages").insert(messages.map((m) => ({ user_id: userId, subject_id: subjectId, conversation_id: conversationId, role: m.role, content: m.text, sources: m.sources || [], mode: m.mode || null, relevant: m.relevant ?? null })));
  if (error) throw error;
  await sb.from("notebook_conversations").update({ updated_at: new Date().toISOString() }).eq("user_id", userId).eq("id", conversationId);
}

export async function deleteConversation(sb, userId, subjectId, id) {
  const { data, error } = await sb.from("notebook_conversations").delete().eq("user_id", userId).eq("subject_id", subjectId).eq("id", id).select("id");
  if (error) throw error;
  return data.length > 0;
}
