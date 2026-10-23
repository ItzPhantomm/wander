#!/usr/bin/env -S node --no-warnings=ExperimentalWarning
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Filter out experimental SQLite warnings if spawned through another node invocation
process.on("warning", (warning) => {
  if (warning.name === "ExperimentalWarning") return;
  console.warn(warning);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distPath = join(__dirname, "..", "dist", "cli.js");

if (existsSync(distPath)) {
  await import(distPath);
} else {
  const srcPath = join(__dirname, "..", "src", "cli", "index.ts");
  try {
    await import(srcPath);
  } catch (err) {
    console.error("Wander initialization error. Please run 'npm run build' in the Wander directory.");
    console.error(err);
    process.exit(1);
  }
}
