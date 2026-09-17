import nextConfig from "eslint-config-next";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextConfig,
  ...nextTs,
  {
    ignores: [".next/**", "public/sw.js", "node_modules/**", "src/lib/api/schema.d.ts"],
  },
];

export default config;
