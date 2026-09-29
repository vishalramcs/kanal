"use client";
// Browser client for the subject notebook API: /api/subjects/:id/{materials,notebook/...}

async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, { ...options, headers: { ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  } catch {
    throw new Error("Can't reach the server. Check your connection.");
  }
  if (res.status === 401) {
    window.location.assign("/login?error=session");
    throw new Error("Please sign in again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || "Something went wrong. Please try again.");
  return data;
}

const base = (subjectId) => `/api/subjects/${encodeURIComponent(subjectId)}`;

export const listMaterials = (subjectId) => request(`${base(subjectId)}/materials`);
export const deleteMaterial = (subjectId, id) => request(`${base(subjectId)}/materials/${id}`, { method: "DELETE" });
/** Opens the original file (PDFs at the cited page) through an authorised, short-lived link. */
export const materialUrl = (subjectId, id, page) => `${base(subjectId)}/materials/${id}${page ? `?page=${page}` : ""}`;
export const listConversations = (subjectId) => request(`${base(subjectId)}/notebook/conversations`).then((d) => d.conversations);
export const getConversation = (subjectId, id) => request(`${base(subjectId)}/notebook/conversations/${id}`).then((d) => d.conversation);
export const deleteConversation = (subjectId, id) => request(`${base(subjectId)}/notebook/conversations/${id}`, { method: "DELETE" });
export const runTool = (subjectId, body) => request(`${base(subjectId)}/notebook/tools`, { method: "POST", body: JSON.stringify(body) });

/** Upload with progress (XHR reports upload progress; fetch can't). onProgress(0..1). */
export function uploadMaterial(subjectId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base(subjectId)}/materials`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* keep {} */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data.material);
      else reject(new Error(data?.error?.message || "Upload failed. Please try again."));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** Stream a notebook answer. onEvent receives {type:"meta"|"delta"|"error"|"done", ...}. */
export async function streamChat(subjectId, body, onEvent) {
  let res;
  try {
    res = await fetch(`${base(subjectId)}/notebook/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("Can't reach the server. Check your connection.");
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || "The notebook is unavailable right now.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
  }
}
