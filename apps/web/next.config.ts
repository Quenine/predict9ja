import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  // ESLint 9 flat config runs through the workspace lint gate; Next 15 cannot reliably detect
  // plugins imported from a shared flat config during `next build`.
  eslint: { ignoreDuringBuilds: true },
};
export default config;
