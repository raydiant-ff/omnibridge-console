import type { NextConfig } from "next";
import path from "path";

const config: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  transpilePackages: [
    "@omnibridge/ui",
    "@omnibridge/auth",
    "@omnibridge/db",
    "@omnibridge/stripe",
    "@omnibridge/salesforce",
  ],
};

export default config;
