import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "node:path";

// .env único na raiz do monorepo
config({ path: path.resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@influa/core"],
  serverExternalPackages: ["pg", "pg-boss", "bcryptjs"],
  experimental: {
    serverActions: { bodySizeLimit: "4mb" }, // upload de print (já reduzido no browser)
  },
};

export default nextConfig;
