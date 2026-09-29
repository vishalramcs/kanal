"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { listMaterials } from "@/lib/notebookApi";
import { notify } from "@/lib/toast";

/** A subject's materials + conversation count; polls every 2 s while any file is still processing. */
export function useMaterials(subjectId) {
  const [data, setData] = useState({ materials: [], conversationCount: 0 });
  const [status, setStatus] = useState({ loading: true, error: null });
  const previous = useRef(new Map());

  const refresh = useCallback(async () => {
    try {
      const res = await listMaterials(subjectId);
      // Announce processing results once: "Trees.pdf is ready ✓" / failure.
      for (const m of res.materials) {
        if (previous.current.get(m.id) === "processing" && m.status === "ready") notify(`${m.filename} is ready ✓`);
        if (previous.current.get(m.id) === "processing" && m.status === "failed") notify(`We couldn't process ${m.filename}. Try uploading it again.`);
      }
      previous.current = new Map(res.materials.map((m) => [m.id, m.status]));
      setData(res);
      setStatus({ loading: false, error: null });
    } catch (err) {
      setStatus({ loading: false, error: err.message });
    }
  }, [subjectId]);

  useEffect(() => { refresh(); }, [refresh]);
  const processing = data.materials.some((m) => m.status === "processing");
  useEffect(() => {
    if (!processing) return undefined;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [processing, refresh]);

  return { ...data, ...status, refresh };
}
