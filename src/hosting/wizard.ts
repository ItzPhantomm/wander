import readline from "node:readline/promises";
import { loadConfig, saveConfig, hasCompletedSetup } from "./config.js";
import { CloudflareManager, switchHosting } from "./cloudflare.js";
import { HarnessConnector } from "./connector.js";
import { WanderConfig } from "../core/types.js";
import { logger } from "../utils/logger.js";

/**
 * Runs the interactive hosting setup wizard on first launch or when explicitly invoked.
 */
export async function runSetupWizard(force = false): Promise<WanderConfig> {
  const currentConfig = loadConfig();

  // If already configured and not forced, return existing
  if (hasCompletedSetup() && !force) {
    return currentConfig;
  }

  // If not running in a TTY (e.g. piped or CI), default to local mode safely
  if (!process.stdin.isTTY) {
    logger.info("Non-interactive terminal detected: Initializing default Local hosting mode.");
    saveConfig(currentConfig);
    return currentConfig;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("\n=======================================================");
  console.log("       🌟 Welcome to Wander Search Setup 🌟          ");
  console.log("  Open-Source Search for Humans, Terminals & AI Agents ");
  console.log("=======================================================\n");
  console.log("Choose how you would like Wander's search backend to run:\n");
  console.log("  [1] Local (Recommended)");
  console.log("      - Runs 100% locally on your machine");
  console.log("      - Zero external accounts, zero latency, zero cloud config");
  console.log("      - SQLite caching & parallel provider queries\n");
  console.log("  [2] Cloudflare Workers (Serverless)");
  console.log("      - Deploy a dedicated backend to Cloudflare's global edge");
  console.log("      - 100% Free tier friendly (up to 100,000 requests/day)");
  console.log("      - Automatic deployment using Wrangler\n");

  let choice = "1";
  try {
    const answer = await rl.question("Select hosting mode [1/2] (default: 1): ");
    if (answer.trim() === "2") {
      choice = "2";
    }
  } catch {
    choice = "1";
  }

  if (choice === "1") {
    console.log("\n> Configuring Local hosting mode...");
    const updated: WanderConfig = {
      ...currentConfig,
      hosting: {
        mode: "local",
        local: {
          directMode: true,
          port: 8448,
          host: "127.0.0.1"
        }
      }
    };
    saveConfig(updated);
    console.log("✓ Local hosting configured successfully!");
    console.log("✓ Configuration saved to ~/.config/wander/config.json\n");
    console.log("> Connecting Wander MCP server to installed AI harnesses...");
    const connector = new HarnessConnector();
    await connector.connectAll();
    console.log("✓ AI harnesses configured!\n");
    rl.close();
    return updated;
  }

  // Cloudflare mode
  console.log("\n> Checking Cloudflare prerequisites (Wrangler)...");
  const cfManager = new CloudflareManager();
  const auth = await cfManager.checkAuth();

  if (!auth.authenticated) {
    console.log("\n⚠️  Cloudflare Wrangler authentication required.");
    console.log("Wander uses Wrangler to deploy your free backend worker.");
    console.log("Would you like to provide an existing worker URL, or login now?\n");
    console.log("  [1] Enter an existing Cloudflare Worker URL");
    console.log("  [2] Fall back to Local mode for now");

    const subChoice = (await rl.question("\nSelect option [1/2] (default: 2): ")).trim();
    if (subChoice === "1") {
      const url = (await rl.question("Enter your Cloudflare Worker URL (e.g. https://wander.xyz.workers.dev): ")).trim();
      if (url.startsWith("http")) {
        console.log(`> Testing connectivity to ${url}...`);
        const ok = await cfManager.verifyHealth(url);
        if (ok) {
          const updated = (await switchHosting("cloudflare", { workerUrl: url })).config;
          console.log("✓ Cloudflare backend connected and verified!\n");
          rl.close();
          return updated;
        } else {
          console.log("⚠️ Could not verify worker health at that URL. Setting up Local mode as safe fallback.");
        }
      }
    }

    console.log("> Defaulting to Local mode. You can switch to Cloudflare anytime using 'wander config'.");
    saveConfig(currentConfig);
    rl.close();
    return currentConfig;
  }

  console.log(`✓ Authenticated with Cloudflare as: ${auth.accountName}`);
  console.log("> Ready to deploy Wander backend to Cloudflare Workers.");
  const confirm = (await rl.question("Proceed with automatic Wrangler deployment? [Y/n]: ")).trim().toLowerCase();

  if (confirm === "n" || confirm === "no") {
    console.log("> Deployment cancelled. Saved Local mode configuration.");
    saveConfig(currentConfig);
    rl.close();
    return currentConfig;
  }

  console.log("> Compiling and deploying worker. Please wait...");
  const res = await cfManager.deploy();
  if (res.success && res.workerUrl) {
    const updated = (await switchHosting("cloudflare", { workerUrl: res.workerUrl })).config;
    console.log(`\n🎉 Success! Wander backend deployed to: ${res.workerUrl}`);
    console.log("✓ All searches will now route through your Cloudflare worker.");
    rl.close();
    return updated;
  } else {
    console.log(`\n⚠️ Deployment failed: ${res.error}`);
    console.log("> Preserved Local mode configuration. Search will continue running locally.\n");
    saveConfig(currentConfig);
    rl.close();
    return currentConfig;
  }
}
