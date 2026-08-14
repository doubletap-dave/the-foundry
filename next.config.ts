import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "better-sqlite3",
    "@langchain/core",
    "@langchain/openai",
    "@langchain/langgraph",
  ],
};

export default nextConfig;
