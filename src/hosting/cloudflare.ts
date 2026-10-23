import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { safeFetch } from "../utils/http.js";
import { logger } from "../utils/logger.js";
import { loadConfig, saveConfig } from "./config.js";
import { WanderConfig } from "../core/types.js";

const execAsync = promisify(exec);

export interface CloudflareDeployResult {
  success: boolean;
  workerUrl?: string;
  error?: string;
}

export class CloudflareManager {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || path.resolve(new URL(".", import.meta.url).pathname, "../..");
  }

  /**
   * Checks whether Wrangler CLI is available and user is authenticated.
   */
  async checkAuth(): Promise<{ authenticated: boolean; accountName?: string; error?: string }> {
    try {
      const { stdout } = await execAsync("npx --yes wrangler whoami", { timeout: 15000 });
      if (stdout.includes("You are logged in") || stdout.includes("Account")) {
        const match = stdout.match(/Account Name:\s*([^\n]+)/) || stdout.match(/logged in as ([^\n]+)/);
        return {
          authenticated: true,
          accountName: match ? match[1].trim() : "Cloudflare User"
        };
      }
      return {
        authenticated: false,
        error: "Not authenticated. Please run 'npx wrangler login' or export CLOUDFLARE_API_TOKEN."
      };
    } catch (err: any) {
      return {
        authenticated: false,
        error: err.message || "Failed to run wrangler whoami"
      };
    }
  }

  /**
   * Bundles the Cloudflare Worker script.
   */
  async buildWorker(): Promise<boolean> {
    const cloudflareDir = path.join(this.projectRoot, "cloudflare");
    const distDir = path.join(cloudflareDir, "dist");
    fs.mkdirSync(distDir, { recursive: true });

    try {
      logger.info("Bundling Cloudflare Worker backend with tsup...");
      await execAsync("npx tsup cloudflare/worker.ts --format esm --out-dir cloudflare/dist --target es2022", {
        cwd: this.projectRoot,
        timeout: 30000
      });
      return true;
    } catch (err: any) {
      logger.error(`Cloudflare worker build failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Deploys the worker using Wrangler.
   */
  async deploy(): Promise<CloudflareDeployResult> {
    const cloudflareDir = path.join(this.projectRoot, "cloudflare");

    // 1. Check auth
    const auth = await this.checkAuth();
    if (!auth.authenticated) {
      return {
        success: false,
        error: `Cloudflare authentication required: ${auth.error}\nRun 'npx wrangler login' or set CLOUDFLARE_API_TOKEN to proceed.`
      };
    }

    // 2. Build worker
    const built = await this.buildWorker();
    if (!built) {
      return {
        success: false,
        error: "Failed to compile Cloudflare worker bundle."
      };
    }

    // 3. Deploy via Wrangler
    try {
      logger.info("Deploying Wander backend to Cloudflare Workers...");
      const { stdout, stderr } = await execAsync("npx --yes wrangler deploy", {
        cwd: cloudflareDir,
        timeout: 60000
      });

      // Extract worker URL from wrangler output (e.g. https://wander-backend.xyz.workers.dev)
      const urlMatch = stdout.match(/https:\/\/[a-zA-Z0-9\-_.]+\.workers\.dev/);
      const workerUrl = urlMatch ? urlMatch[0] : undefined;

      if (!workerUrl) {
        logger.warn(`Could not automatically detect worker URL from wrangler output:\n${stdout}`);
        return {
          success: true,
          error: "Deployed, but could not parse workers.dev URL automatically from output."
        };
      }

      // 4. Verify health check on deployed worker
      logger.info(`Verifying deployed worker health at ${workerUrl}/api/health...`);
      const health = await this.verifyHealth(workerUrl);
      if (!health) {
        return {
          success: false,
          workerUrl,
          error: `Worker deployed at ${workerUrl} failed health check.`
        };
      }

      return {
        success: true,
        workerUrl
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Wrangler deployment failed: ${err.message}`
      };
    }
  }

  /**
   * Verifies connectivity and health of a Cloudflare worker URL.
   */
  async verifyHealth(workerUrl: string): Promise<boolean> {
    try {
      const cleanUrl = workerUrl.replace(/\/+$/, "");
      const res = await safeFetch(`${cleanUrl}/api/health`, { timeoutMs: 10000 });
      if (res.ok) {
        const data = await res.json();
        return data.status === "healthy" || data.status === "ok";
      }
      return false;
    } catch {
      return false;
    }
  }
}

/**
 * Safely switches hosting mode between 'local' and 'cloudflare' while preserving
 * the previous working setup if the switch or deployment fails.
 */
export async function switchHosting(
  targetMode: "local" | "cloudflare",
  options: { workerUrl?: string; autoDeploy?: boolean } = {}
): Promise<{ success: boolean; message: string; config: WanderConfig }> {
  const currentConfig = loadConfig();
  const previousMode = currentConfig.hosting.mode;

  if (targetMode === "local") {
    const updated: WanderConfig = {
      ...currentConfig,
      hosting: {
        ...currentConfig.hosting,
        mode: "local",
        local: {
          directMode: true,
          port: 8448,
          host: "127.0.0.1"
        }
      }
    };
    saveConfig(updated);
    return {
      success: true,
      message: "Successfully switched hosting mode to Local (direct zero-overhead mode).",
      config: updated
    };
  }

  // Target is Cloudflare
  const cfManager = new CloudflareManager();

  // If a worker URL was directly provided, verify it first
  if (options.workerUrl) {
    const isHealthy = await cfManager.verifyHealth(options.workerUrl);
    if (!isHealthy) {
      // PRESERVE PREVIOUS SETUP
      return {
        success: false,
        message: `Health check failed for provided Cloudflare Worker URL: ${options.workerUrl}. Previous setup (${previousMode}) preserved.`,
        config: currentConfig
      };
    }

    const updated: WanderConfig = {
      ...currentConfig,
      hosting: {
        ...currentConfig.hosting,
        mode: "cloudflare",
        cloudflare: {
          workerUrl: options.workerUrl,
          deployedAt: new Date().toISOString()
        }
      }
    };
    saveConfig(updated);
    return {
      success: true,
      message: `Successfully connected to Cloudflare Worker at ${options.workerUrl}.`,
      config: updated
    };
  }

  // If autoDeploy is requested or needed
  if (options.autoDeploy) {
    const deployResult = await cfManager.deploy();
    if (!deployResult.success || !deployResult.workerUrl) {
      // PRESERVE PREVIOUS SETUP
      return {
        success: false,
        message: `Cloudflare deployment failed: ${deployResult.error}. Previous setup (${previousMode}) preserved.`,
        config: currentConfig
      };
    }

    const updated: WanderConfig = {
      ...currentConfig,
      hosting: {
        ...currentConfig.hosting,
        mode: "cloudflare",
        cloudflare: {
          workerUrl: deployResult.workerUrl,
          deployedAt: new Date().toISOString()
        }
      }
    };
    saveConfig(updated);
    return {
      success: true,
      message: `Successfully deployed and switched to Cloudflare Worker at ${deployResult.workerUrl}.`,
      config: updated
    };
  }

  return {
    success: false,
    message: "Cloudflare mode requires either a valid workerUrl or autoDeploy option.",
    config: currentConfig
  };
}
