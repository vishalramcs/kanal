/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Native / heavy server-only packages used by the notebook: load them from node_modules at runtime.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp", "unpdf"],
  // On Vercel the notebook uses Gemini embeddings; the local model (~300 MB) would exceed the 250 MB function limit.
  ...(process.env.VERCEL && {
    outputFileTracingExcludes: {
      "*": ["node_modules/onnxruntime-node/**", "node_modules/onnxruntime-web/**", "node_modules/@huggingface/transformers/**", "node_modules/sharp/**", "node_modules/@img/**"],
    },
  }),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
