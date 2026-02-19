import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: [
    "@omnibridge/ui",
    "@omnibridge/auth",
    "@omnibridge/db",
    "@omnibridge/stripe",
    "@omnibridge/salesforce",
  ],
};

export default config;
