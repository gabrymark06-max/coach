import { createSerwistRoute } from "@serwist/turbopack";

const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now());

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
  esbuildOptions: {
    define: { "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") },
  },
});
