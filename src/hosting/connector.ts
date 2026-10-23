import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { logger } from "../utils/logger.js";

export interface HarnessConnectionResult {
  harness: string;
  configPath: string;
  status: "connected" | "updated" | "skipped" | "failed";
  error?: string;
}

export class HarnessConnector {
  private homedir: string;

  constructor(homedir = os.homedir()) {
    this.homedir = homedir;
  }

  /**
   * Automatically discovers and connects Wander to all detected AI harnesses on the machine.
   */
  async connectAll(): Promise<HarnessConnectionResult[]> {
    const results: HarnessConnectionResult[] = [];

    results.push(await this.connectAntigravity());
    results.push(await this.connectClaude());
    results.push(await this.connectCursor());
    results.push(await this.connectCodex());

    return results;
  }

  /**
   * Connect to Google Antigravity / Gemini Harness (~/.gemini/config/mcp_config.json)
   */
  async connectAntigravity(): Promise<HarnessConnectionResult> {
    const geminiDir = path.join(this.homedir, ".gemini", "config");
    const configPath = path.join(geminiDir, "mcp_config.json");

    try {
      fs.mkdirSync(geminiDir, { recursive: true });
      let current: any = {};
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, "utf-8").trim();
        if (raw) {
          try {
            current = JSON.parse(raw);
          } catch {}
        }
      }

      current.mcpServers = current.mcpServers || {};
      current.mcpServers.wander = {
        command: "wander",
        args: ["mcp"]
      };

      fs.writeFileSync(configPath, JSON.stringify(current, null, 2), "utf-8");

      // Also register in ~/.gemini/antigravity-cli/ if present
      const cliDir = path.join(this.homedir, ".gemini", "antigravity-cli");
      if (fs.existsSync(cliDir)) {
        const cliConfigPath = path.join(cliDir, "mcp_config.json");
        fs.writeFileSync(cliConfigPath, JSON.stringify(current, null, 2), "utf-8");
      }

      return {
        harness: "Google Antigravity CLI",
        configPath,
        status: "connected"
      };
    } catch (err: any) {
      return {
        harness: "Google Antigravity CLI",
        configPath,
        status: "failed",
        error: err.message
      };
    }
  }

  /**
   * Connect to Claude Code / Claude Desktop (~/.claude.json)
   */
  async connectClaude(): Promise<HarnessConnectionResult> {
    const claudeJsonPath = path.join(this.homedir, ".claude.json");
    try {
      let current: any = {};
      if (fs.existsSync(claudeJsonPath)) {
        const raw = fs.readFileSync(claudeJsonPath, "utf-8").trim();
        if (raw) {
          try {
            current = JSON.parse(raw);
          } catch {}
        }
      }

      current.mcpServers = current.mcpServers || {};
      current.mcpServers.wander = {
        command: "wander",
        args: ["mcp"]
      };

      fs.writeFileSync(claudeJsonPath, JSON.stringify(current, null, 2), "utf-8");

      // Check desktop config directory as well
      const desktopDir = path.join(this.homedir, ".claude");
      if (fs.existsSync(desktopDir)) {
        const desktopFile = path.join(desktopDir, "claude_desktop_config.json");
        let dConfig: any = {};
        if (fs.existsSync(desktopFile)) {
          try { dConfig = JSON.parse(fs.readFileSync(desktopFile, "utf-8")); } catch {}
        }
        dConfig.mcpServers = dConfig.mcpServers || {};
        dConfig.mcpServers.wander = {
          command: "wander",
          args: ["mcp"]
        };
        fs.writeFileSync(desktopFile, JSON.stringify(dConfig, null, 2), "utf-8");
      }

      return {
        harness: "Claude Code / Desktop",
        configPath: claudeJsonPath,
        status: "connected"
      };
    } catch (err: any) {
      return {
        harness: "Claude Code / Desktop",
        configPath: claudeJsonPath,
        status: "failed",
        error: err.message
      };
    }
  }

  /**
   * Connect to Cursor IDE (~/.cursor/mcp.json)
   */
  async connectCursor(): Promise<HarnessConnectionResult> {
    const cursorDir = path.join(this.homedir, ".cursor");
    const configPath = path.join(cursorDir, "mcp.json");
    try {
      fs.mkdirSync(cursorDir, { recursive: true });
      let current: any = {};
      if (fs.existsSync(configPath)) {
        try { current = JSON.parse(fs.readFileSync(configPath, "utf-8")); } catch {}
      }

      current.mcpServers = current.mcpServers || {};
      current.mcpServers.wander = {
        command: "wander",
        args: ["mcp"]
      };

      fs.writeFileSync(configPath, JSON.stringify(current, null, 2), "utf-8");

      return {
        harness: "Cursor IDE",
        configPath,
        status: "connected"
      };
    } catch (err: any) {
      return {
        harness: "Cursor IDE",
        configPath,
        status: "failed",
        error: err.message
      };
    }
  }

  /**
   * Connect to Codex / OpenCode (~/.codex/mcp.json)
   */
  async connectCodex(): Promise<HarnessConnectionResult> {
    const codexDir = path.join(this.homedir, ".codex");
    const configPath = path.join(codexDir, "mcp.json");
    try {
      fs.mkdirSync(codexDir, { recursive: true });
      let current: any = {};
      if (fs.existsSync(configPath)) {
        try { current = JSON.parse(fs.readFileSync(configPath, "utf-8")); } catch {}
      }

      current.mcpServers = current.mcpServers || {};
      current.mcpServers.wander = {
        command: "wander",
        args: ["mcp"]
      };

      fs.writeFileSync(configPath, JSON.stringify(current, null, 2), "utf-8");

      return {
        harness: "OpenAI Codex CLI",
        configPath,
        status: "connected"
      };
    } catch (err: any) {
      return {
        harness: "OpenAI Codex CLI",
        configPath,
        status: "failed",
        error: err.message
      };
    }
  }
}
