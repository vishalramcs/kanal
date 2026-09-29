// Embedding provider abstraction. Server only.
//   EMBEDDING_PROVIDER=gemini  -> Gemini embeddings (reuses GEMINI_API_KEY)
//   EMBEDDING_PROVIDER=local   -> all-MiniLM-L6-v2 running on this server (no key, works offline after first download)
//   EMBEDDING_PROVIDER=auto    -> gemini when a key is set, otherwise local (default)
// Every vector is L2-normalised, so cosine similarity is a plain dot product.
import path from "node:path";
import { embedWithGemini, isConfigured } from "../gemini.js";

const LOCAL_MODEL = "Xenova/all-MiniLM-L6-v2";
const GEMINI_DIMS = 768;
let localPipeline = null;

export function providerName() {
  const p = (process.env.EMBEDDING_PROVIDER || "auto").toLowerCase();
  if (p === "gemini" || p === "local") return p;
  return isConfigured() ? "gemini" : "local";
}

export const normalize = (v) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};

async function embedLocal(texts) {
  if (!localPipeline) {
    if (process.env.VERCEL) throw new Error("Set GEMINI_API_KEY: the local embedding model isn't bundled on Vercel.");
    const { env, pipeline } = await import("@huggingface/transformers");
    env.cacheDir = path.join(process.env.NOTEBOOK_DATA_DIR || ".data", "models");
    localPipeline = pipeline("feature-extraction", LOCAL_MODEL, { dtype: "q8" });
  }
  const extractor = await localPipeline;
  const vectors = [];
  for (let i = 0; i < texts.length; i += 32) {
    const out = await extractor(texts.slice(i, i + 32), { pooling: "mean", normalize: true });
    vectors.push(...out.tolist());
  }
  return { vectors, model: `local:${LOCAL_MODEL}` };
}

/** kind: "document" for chunks (stored once), "query" for questions. */
export async function embedTexts(texts, kind = "document") {
  if (!texts.length) return { vectors: [], model: activeModel() };
  if (providerName() === "gemini") {
    const res = await embedWithGemini(texts, kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT", GEMINI_DIMS);
    return { vectors: res.vectors.map(normalize), model: res.model };
  }
  return embedLocal(texts);
}

export function activeModel() {
  return providerName() === "gemini"
    ? `gemini:${process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001"}:${GEMINI_DIMS}`
    : `local:${LOCAL_MODEL}`;
}

/** Below this similarity, retrieved text is too weakly related to count as an answer. */
export const minScore = () => Number(process.env.RAG_MIN_SCORE) || (providerName() === "gemini" ? 0.5 : 0.3);
