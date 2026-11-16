import type { NextConfig } from "next";

/**
 * wagmi's Base Account connector lazily imports @base-org/account, which drags
 * in @coinbase/cdp-sdk and its uninstalled optional x402 dependencies. We don't
 * offer Base Account in the wallet list, so alias it to an empty module.
 */
const EMPTY = "./src/lib/stubs/empty.js";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: __dirname,
    resolveAlias: { "@base-org/account": EMPTY },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
