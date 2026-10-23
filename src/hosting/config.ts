import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { WanderConfig, HostingMode } from "../core/types.js";

const CONFIG_DIR = path.join(os.homedir(), ".config", "wander");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export const DEFAULT_CONFIG: WanderConfig = {
  version: "1.0.0",
  hosting: {
    mode: "local",
    local: {
      directMode: true,
      port: 8448,
      host: "127.0.0.1"
    }
  },
  search: {
    defaultProviders: ["duckduckgo", "wikipedia", "hackernews", "github", "searxng", "arxiv", "crossref"],
    timeoutMs: 6000,
    maxResults: 15,
    cacheTtlMinutes: 30
  }
};

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function hasCompletedSetup(): boolean {
  try {
    return fs.existsSync(CONFIG_FILE);
  } catch {
    return false;
  }
}

export function loadConfig(): WanderConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        hosting: {
          ...DEFAULT_CONFIG.hosting,
          ...(parsed.hosting || {})
        },
        search: {
          ...DEFAULT_CONFIG.search,
          ...(parsed.search || {})
        }
      };
    }
  } catch (err) {
    // If error reading, return default
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: WanderConfig): void {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (err: any) {
    throw new Error(`Failed to save Wander configuration to ${CONFIG_FILE}: ${err.message}`);
  }
}
