import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      cli: "src/cli/index.ts",
      mcp: "src/mcp/server.ts"
    },
    format: ["esm"],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: "node20"
  },
  {
    entry: {
      "worker": "cloudflare/worker.ts"
    },
    format: ["esm"],
    outDir: "cloudflare/dist",
    dts: false,
    splitting: false,
    target: "es2022"
  }
]);
