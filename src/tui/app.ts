import readline from "node:readline";
import fs from "node:fs";
import { exec } from "node:child_process";
import { SearchEngine } from "../core/engine.js";
import { SearchResult, WanderConfig } from "../core/types.js";
import { sanitizeForTerminal } from "../core/security.js";

export class WanderTUI {
  private engine: SearchEngine;
  private config: WanderConfig;
  private query = "";
  private results: SearchResult[] = [];
  private selectedIndex = 0;
  private isSearching = false;
  private statusMessage = "Type a search query and press Enter";
  private isSearchFocused = true;
  private showPreview = true;
  private page = 0;
  private pageSize = 6;
  private isRunning = false;

  constructor(engine: SearchEngine, config: WanderConfig) {
    this.engine = engine;
    this.config = config;
  }

  start() {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      console.log("Terminal UI requires an interactive TTY.");
      return;
    }

    this.isRunning = true;
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    // Enter alternate screen buffer & hide cursor
    process.stdout.write("\x1b[?1049h\x1b[?25l");

    this.render();

    const onKeypress = (str: string | undefined, key: readline.Key) => {
      if (!this.isRunning) return;

      // Global Exit
      if ((key.ctrl && key.name === "c") || (key.name === "escape" && !this.isSearchFocused) || (str === "q" && !this.isSearchFocused)) {
        this.cleanup();
        process.exit(0);
      }

      if (this.isSearchFocused) {
        this.handleSearchInput(str, key);
      } else {
        this.handleNavigationInput(str, key);
      }

      this.render();
    };

    process.stdin.on("keypress", onKeypress);
    process.stdout.on("resize", () => this.render());
  }

  private cleanup() {
    this.isRunning = false;
    process.stdout.write("\x1b[?25h\x1b[?1049l"); // Show cursor & restore normal screen
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }

  private handleSearchInput(str: string | undefined, key: readline.Key) {
    if (key.name === "return") {
      if (this.query.trim().length > 0) {
        this.executeSearch();
      }
      return;
    }

    if (key.name === "backspace") {
      this.query = this.query.slice(0, -1);
      return;
    }

    if (key.name === "down" || key.name === "tab") {
      if (this.results.length > 0) {
        this.isSearchFocused = false;
        this.selectedIndex = 0;
      }
      return;
    }

    if (str && str.length === 1 && !key.ctrl && !key.meta) {
      this.query += str;
    }
  }

  private handleNavigationInput(str: string | undefined, key: readline.Key) {
    if (key.name === "up") {
      if (this.selectedIndex > 0) {
        this.selectedIndex--;
      } else {
        // Back to search input
        this.isSearchFocused = true;
      }
      return;
    }

    if (key.name === "down") {
      if (this.selectedIndex < this.results.length - 1) {
        this.selectedIndex++;
      }
      return;
    }

    if (key.name === "pageup") {
      this.selectedIndex = Math.max(0, this.selectedIndex - this.pageSize);
      return;
    }

    if (key.name === "pagedown") {
      this.selectedIndex = Math.min(this.results.length - 1, this.selectedIndex + this.pageSize);
      return;
    }

    if (str === "/" || str === "s") {
      this.isSearchFocused = true;
      return;
    }

    if (key.name === "return") {
      // Open selected URL in default browser
      const selected = this.results[this.selectedIndex];
      if (selected) {
        this.openUrl(selected.url);
      }
      return;
    }

    if (str === "c") {
      // Copy URL to clipboard
      const selected = this.results[this.selectedIndex];
      if (selected) {
        this.copyToClipboard(selected.url);
      }
      return;
    }

    if (str === "j") {
      // Export JSON
      this.exportJson();
      return;
    }

    if (str === "p") {
      this.showPreview = !this.showPreview;
      return;
    }
  }

  private async executeSearch() {
    this.isSearching = true;
    this.statusMessage = `Searching across providers for "${this.query}"...`;
    this.render();

    try {
      const results = await this.engine.search(this.query, { limit: 25 });
      this.results = results;
      this.selectedIndex = 0;
      this.isSearchFocused = false;
      this.statusMessage = `Found ${results.length} results. Use ↑/↓ to navigate, Enter to open.`;
    } catch (err: any) {
      this.statusMessage = `Search failed: ${err.message}`;
    } finally {
      this.isSearching = false;
      this.render();
    }
  }

  private openUrl(url: string) {
    const cmd = process.platform === "darwin" ? "open" :
                process.platform === "win32" ? "start" : "xdg-open";
    exec(`${cmd} "${url}"`, () => {});
    this.statusMessage = `Opened in browser: ${url}`;
  }

  private copyToClipboard(text: string) {
    try {
      if (process.platform === "darwin") {
        exec(`printf "${text}" | pbcopy`);
      } else if (process.platform === "win32") {
        exec(`clip`, (err, stdin) => {});
      } else {
        exec(`printf "${text}" | xclip -selection clipboard 2>/dev/null || printf "${text}" | wl-copy 2>/dev/null`);
      }
      this.statusMessage = `Copied to clipboard: ${text}`;
    } catch {
      this.statusMessage = `URL: ${text}`;
    }
  }

  private exportJson() {
    try {
      const fileName = `wander-results-${Date.now()}.json`;
      fs.writeFileSync(fileName, JSON.stringify(this.results, null, 2), "utf-8");
      this.statusMessage = `Exported ${this.results.length} results to ${fileName}`;
    } catch (err: any) {
      this.statusMessage = `Export failed: ${err.message}`;
    }
  }

  private render() {
    const width = process.stdout.columns || 80;
    const height = process.stdout.rows || 24;

    const reset = "\x1b[0m";
    const bold = "\x1b[1m";
    const dim = "\x1b[2m";
    const cyan = "\x1b[36m";
    const green = "\x1b[32m";
    const yellow = "\x1b[33m";
    const magenta = "\x1b[35m";
    const bgBlue = "\x1b[44m\x1b[37m";
    const inverse = "\x1b[7m";

    let buffer = "\x1b[H"; // Move to 0,0

    // Header Bar
    const modeBadge = `[Mode: ${this.config.hosting.mode.toUpperCase()}]`;
    const headerTitle = `  🌐 WANDER SEARCH ENGINE  ${dim}${modeBadge}${reset}`;
    buffer += `${bgBlue}${bold}${headerTitle.padEnd(width)}${reset}\n`;

    // Search Input Line
    const focusMarker = this.isSearchFocused ? `${cyan}▶ ${bold}` : `  ${dim}`;
    const cursorChar = this.isSearchFocused ? "█" : "";
    const searchLine = `${focusMarker}Search: ${reset}${this.query}${cyan}${cursorChar}${reset}`;
    buffer += `\n${searchLine}\n`;
    buffer += `${dim}${"─".repeat(width)}${reset}\n`;

    // Main Result Area
    const startIdx = Math.floor(this.selectedIndex / this.pageSize) * this.pageSize;
    const visibleResults = this.results.slice(startIdx, startIdx + this.pageSize);

    if (this.isSearching) {
      buffer += `\n   ${yellow}⏳ Querying distributed providers in parallel...${reset}\n\n`;
    } else if (this.results.length === 0) {
      if (this.query.length === 0) {
        buffer += `\n   ${dim}Welcome to Wander. Enter your query above and press Enter.${reset}\n`;
        buffer += `   ${dim}Providers: DuckDuckGo, Wikipedia, HackerNews, GitHub, arXiv, SearXNG, Crossref${reset}\n\n`;
      } else {
        buffer += `\n   ${yellow}No results found for "${this.query}". Try different terms.${reset}\n\n`;
      }
    } else {
      visibleResults.forEach((item, relIdx) => {
        const absIdx = startIdx + relIdx;
        const isSelected = absIdx === this.selectedIndex && !this.isSearchFocused;
        const selector = isSelected ? `${cyan}${bold}❯ ` : "  ";
        const titleColor = isSelected ? `${inverse}${bold}` : `${bold}${cyan}`;
        const sourceBadge = `${magenta}[${item.source}]${reset}`;

        const cleanTitle = sanitizeForTerminal(item.title).slice(0, width - 25);
        buffer += `${selector}${titleColor}${absIdx + 1}. ${cleanTitle}${reset} ${sourceBadge}\n`;
        buffer += `     ${green}${item.url.slice(0, width - 10)}${reset}\n`;

        const cleanSnippet = sanitizeForTerminal(item.snippet).slice(0, width - 10);
        buffer += `     ${dim}${cleanSnippet}${reset}\n\n`;
      });
    }

    // Selected Item Detail Box / Preview
    if (this.showPreview && this.results[this.selectedIndex] && !this.isSearching) {
      const selected = this.results[this.selectedIndex];
      buffer += `${dim}${"─".repeat(width)}${reset}\n`;
      buffer += `${bold}Preview Details:${reset} [${selected.source}] Score: ${selected.score}\n`;
      buffer += `${dim}${sanitizeForTerminal(selected.snippet).slice(0, width * 2)}${reset}\n`;
    }

    // Fill remaining lines
    const currentLines = buffer.split("\n").length;
    if (currentLines < height - 2) {
      buffer += "\n".repeat(height - 2 - currentLines);
    }

    // Status & Shortcut Bar
    const navHelp = this.isSearchFocused
      ? `[Enter] Search  [↓/Tab] Results  [Ctrl+C] Exit`
      : `[↑/↓] Select  [Enter] Open  [c] Copy  [j] JSON  [/] Search  [p] Preview  [q] Quit`;

    buffer += `\n${inverse} ${this.statusMessage.slice(0, width - 40).padEnd(width - 40)} ${navHelp.padStart(38)} ${reset}`;

    process.stdout.write(buffer);
  }
}
