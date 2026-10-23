#!/usr/bin/env node
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distPath = join(__dirname, "..", "dist", "cli.js");

if (existsSync(distPath)) {
  await import(distPath);
} else {
  // If running from source checkout before build
  const srcPath = join(__dirname, "..", "src", "cli", "index.ts");
  try {
    await import(srcPath);
  } catch (err) {
    console.error("Wander initialization error. Please run 'npm run build' in the Wander directory.");
    console.error(err);
    process.exit(1);
  }
}
