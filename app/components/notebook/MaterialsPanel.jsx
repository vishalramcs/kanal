"use client";
import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, FileText, Loader2, Presentation, Trash2, Upload } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { deleteMaterial, materialUrl, uploadMaterial } from "@/lib/notebookApi";
import { niceDate } from "@/lib/dates";
import { notify } from "@/lib/toast";

const ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,.txt,.md,.markdown";
const MAX_BYTES = 10 * 1024 * 1024;
const LOCATION = { pages: "pages", slides: "slides", sections: "sections" };

const size = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function checkFile(file) {
  const ext = file.name.toLowerCase().split(".").pop();
  if (!ACCEPT.split(",").includes(`.${ext}`)) return "Upload a PDF, PPT, PPTX, DOC, DOCX, TXT or Markdown file.";
  if (file.size > MAX_BYTES) return "That file is larger than 10 MB.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

function Status({ material }) {
  if (material.status === "ready") return <span className="inline-flex items-center gap-1 text-xs font-extrabold text-strong"><CheckCircle2 size={14} /> Ready</span>;
  if (material.status === "failed") return <span className="inline-flex items-center gap-1 text-xs font-extrabold text-weak"><AlertCircle size={14} /> Failed</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-extrabold text-medium"><Loader2 size={14} className="animate-spin" /> Processing…</span>;
}

/** Subject material library: upload, status, details, open, delete. */
export default function MaterialsPanel({ subject, materials, loading, error, onRetry, onChange }) {
  const [upload, setUpload] = useState(null); // { name, progress, error }
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(null);
  const input = useRef(null);

  const handleFile = async (file) => {
    if (!file || (upload && !upload.error)) return;
    const problem = checkFile(file);
    if (problem) return setUpload({ name: file.name, error: problem });
    setUpload({ name: file.name, progress: 0 });
    try {
      const m = await uploadMaterial(subject.id, file, (p) => setUpload((u) => ({ ...u, progress: p })));
      setUpload(null);
      notify(`Processing ${m.filename}…`);
      onChange();
    } catch (err) {
      setUpload({ name: file.name, error: err.message });
    }
    return undefined;
  };

  const remove = async () => {
    try {
      await deleteMaterial(subject.id, removing.id);
      notify(`${removing.filename} deleted.`);
      onChange();
    } catch (err) {
      notify(err.message);
    }
    setRemoving(null);
  };

  return (
    <section className="rounded-3xl border-2 border-ink bg-paper p-5 shadow-hard sm:p-6" aria-label={`${subject.name} materials`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl">{subject.name} materials</h2>
          <p className="text-sm font-bold text-ink-soft">Only this subject&apos;s notebook reads these.</p>
        </div>
        <Button variant="sun" onClick={() => input.current?.click()}><Upload size={16} /> Upload material</Button>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        className={`mt-5 grid cursor-pointer justify-items-center gap-1 rounded-2xl border-2 border-dashed border-ink px-4 py-6 text-center transition-colors ${dragging ? "bg-sun-soft" : "bg-cream hover:bg-sun-soft"}`}
      >
        <Upload size={22} />
        <span className="font-extrabold">Drop a file here, or tap to choose</span>
        <span className="text-sm text-ink-soft">PDF, PPT, PPTX, DOC, DOCX, TXT, Markdown · up to 10 MB</span>
        <input ref={input} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }} />
      </label>

      {upload && (
        <div className="mt-3 rounded-2xl border-2 border-ink px-4 py-3" role="status" aria-live="polite">
          <p className="truncate text-sm font-extrabold">{upload.name}</p>
          {upload.error ? (
            <p className="text-sm font-bold text-weak">{upload.error} <button type="button" className="underline" onClick={() => setUpload(null)}>Dismiss</button></p>
          ) : (
            <>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full border-2 border-ink bg-cream">
                <div className="h-full bg-cobalt transition-[width]" style={{ width: `${Math.round((upload.progress || 0) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs font-bold text-ink-soft">Uploading… {Math.round((upload.progress || 0) * 100)}%</p>
            </>
          )}
        </div>
      )}

      {loading && <div className="mt-4 h-20 animate-pulse rounded-2xl bg-cream-deep" />}
      {error && <p className="mt-4 font-bold text-weak">{error} <button type="button" className="underline" onClick={onRetry}>Retry</button></p>}
      {!loading && !error && !materials.length && (
        <p className="mt-4 rounded-2xl bg-cream px-4 py-3 font-semibold text-ink-soft">Upload your first study material to start your AI Notebook.</p>
      )}

      <ul className="mt-4 grid gap-2.5">
        {materials.map((m) => {
          const Icon = m.file_type === "pptx" || m.file_type === "ppt" ? Presentation : FileText;
          return (
            <li key={m.id} className={`rounded-2xl border-2 px-4 py-3 ${m.status === "failed" ? "border-weak/60 bg-bubble-soft" : "border-ink/20"}`}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border-2 border-ink bg-sun-soft"><Icon size={17} /></span>
                <div className="min-w-0 grow">
                  <p className="truncate font-extrabold">{m.filename}</p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-bold text-ink-soft">
                    <span className="uppercase">{m.file_type}</span>·<span>{size(m.file_size)}</span>·<span>{niceDate(m.created_at.slice(0, 10))}</span>
                    {m.status === "ready" && m.location_count ? <>·<span>{m.location_count} {LOCATION[m.location_kind] || "sections"}</span></> : null}
                    ·<Status material={m} />
                  </p>
                  {m.status === "failed" && <p className="mt-1 text-sm font-semibold">{m.error || "We couldn't process this file. Try uploading it again."}</p>}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <a href={materialUrl(subject.id, m.id)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${m.filename}`} className="grid size-9 place-items-center rounded-full border-2 border-ink bg-paper"><ExternalLink size={14} /></a>
                  <button type="button" onClick={() => setRemoving(m)} aria-label={`Delete ${m.filename}`} className="grid size-9 place-items-center rounded-full border-2 border-ink bg-paper"><Trash2 size={14} /></button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal open={!!removing} title={`Delete ${removing?.filename}?`} onClose={() => setRemoving(null)}>
        <p className="text-ink-soft">The file and its notebook index will be removed. Past answers keep their quoted passages.</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button onClick={() => setRemoving(null)}>Keep it</Button>
          <Button variant="bubble" onClick={remove}>Delete</Button>
        </div>
      </Modal>
    </section>
  );
}
