import type { NextConfig } from "next";
import path from "path";

const config: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  outputFileTracingIncludes: {
    "/*": ["../../packages/db/generated/client/**"],
  },
  transpilePackages: [
    "@omnibridge/ui",
    "@omnibridge/auth",
    "@omnibridge/db",
    "@omnibridge/stripe",
    "@omnibridge/salesforce",
  ],
};

export default config;
