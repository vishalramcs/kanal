"use client";
import { ExternalLink, FileText } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { materialUrl } from "@/lib/notebookApi";

/** Source references under an answer: "📄 Trees.pdf — Page 42". Click to read the passage. */
export function SourceList({ sources, onOpen }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-2">
      <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-soft">Sources</p>
      <div className="flex flex-wrap gap-2">
        {sources.map((s) => (
          <button key={`${s.n}-${s.chunkId}`} type="button" onClick={() => onOpen(s)}
            className="inline-flex max-w-full items-center gap-1.5 rounded-xl border-2 border-ink bg-paper px-2.5 py-1 text-left text-sm font-bold hover:bg-sun-soft">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-sun text-[11px] font-extrabold">{s.n}</span>
            <FileText size={14} className="shrink-0" />
            <span className="truncate">{s.docName} — {s.location}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The exact passage behind a citation, with a link to the original file (PDFs open at that page). */
export function SourceDialog({ subjectId, source, onClose }) {
  return (
    <Modal open={!!source} title={source ? `${source.docName} — ${source.location}` : ""} onClose={onClose} wide>
      {source && (
        <>
          {source.section && <p className="mb-2 text-sm font-extrabold text-ink-soft">{source.section}</p>}
          <blockquote className="max-h-[50vh] overflow-auto whitespace-pre-line rounded-2xl border-2 border-ink bg-paper p-4 font-semibold">{source.text}</blockquote>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">This is the exact passage the answer was based on.</p>
            <a href={materialUrl(subjectId, source.materialId, source.page)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-sun px-4 py-1.5 text-sm font-extrabold shadow-hard-sm">
              <ExternalLink size={14} /> {source.fileType === "pdf" && source.page ? `Open PDF at page ${source.page}` : "Open original file"}
            </a>
          </div>
        </>
      )}
    </Modal>
  );
}
