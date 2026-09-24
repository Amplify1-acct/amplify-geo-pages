import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  serverExternalPackages: ["openai", "sanitize-html", "sharp"],
  turbopack: { root: process.cwd() },
};

export default nextConfig;
