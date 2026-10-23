import readline from "node:readline";
import fs from "node:fs";
import { exec } from "node:child_process";
import { SearchEngine } from "../core/engine.js";
import { SearchResult, SearchResponse, InstantAnswer, WanderConfig } from "../core/types.js";
import { sanitizeForTerminal } from "../core/security.js";
import { getQuerySuggestions } from "../core/suggestions.js";
import { getHistoryEntries } from "../core/history.js";

type TuiView = "search" | "reader";

export class WanderTUI {
  private engine: SearchEngine;
  private config: WanderConfig;
  private query = "";
  private results: SearchResult[] = [];
  private selectedIndex = 0;
  private isSearching = false;
  private statusMessage = "Type a query and press Enter";
  private toastMessage = "";
  private toastTimer: any = null;
  private isSearchFocused = true;
  private showPreview = true;
  private instantAnswer?: InstantAnswer;
  private suggestions: string[] = [];
  private selectedSuggestion = -1;
  private historyIndex = -1;
  private historyList: string[] = [];

  // Active category filter: "all" | "tech" | "code" | "science"
  private activeCategoryIndex = 0;
  private categories: ("all" | "tech" | "code" | "science")[] = ["all", "tech", "code", "science"];

  // Reader mode state
  private viewMode: TuiView = "search";
  private readerContent: string[] = [];
  private readerTitle = "";
  private readerUrl = "";
  private readerScroll = 0;
  private isReaderLoading = false;

  private isRunning = false;

  constructor(engine: SearchEngine, config: WanderConfig) {
    this.engine = engine;
    this.config = config;
    this.historyList = getHistoryEntries();
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
      if ((key.ctrl && key.name === "c") || (key.name === "escape" && this.viewMode === "search" && !this.isSearchFocused) || (str === "q" && this.viewMode === "search" && !this.isSearchFocused)) {
        this.cleanup();
        process.exit(0);
      }

      if (this.viewMode === "reader") {
        this.handleReaderInput(str, key);
      } else if (this.isSearchFocused) {
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

  private showToast(msg: string) {
    this.toastMessage = msg;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMessage = "";
      if (this.isRunning) this.render();
    }, 3000);
  }

  private async updateSuggestions() {
    if (this.query.trim().length >= 2) {
      try {
        const sugs = await getQuerySuggestions(this.query, 4);
        this.suggestions = sugs;
        if (this.isRunning) this.render();
      } catch {}
    } else {
      this.suggestions = [];
    }
  }

  private handleSearchInput(str: string | undefined, key: readline.Key) {
    if (key.name === "return") {
      if (this.selectedSuggestion >= 0 && this.suggestions[this.selectedSuggestion]) {
        this.query = this.suggestions[this.selectedSuggestion];
        this.suggestions = [];
        this.selectedSuggestion = -1;
      }
      if (this.query.trim().length > 0) {
        this.executeSearch();
      }
      return;
    }

    if (key.name === "tab") {
      if (this.suggestions.length > 0) {
        this.selectedSuggestion = (this.selectedSuggestion + 1) % this.suggestions.length;
        this.query = this.suggestions[this.selectedSuggestion];
      } else if (this.results.length > 0) {
        this.isSearchFocused = false;
        this.selectedIndex = 0;
      }
      return;
    }

    if (key.name === "up") {
      if (this.historyList.length > 0) {
        this.historyIndex = Math.min(this.historyIndex + 1, this.historyList.length - 1);
        this.query = this.historyList[this.historyIndex] || this.query;
      }
      return;
    }

    if (key.name === "down") {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.query = this.historyList[this.historyIndex];
      } else if (this.historyIndex === 0) {
        this.historyIndex = -1;
        this.query = "";
      } else if (this.results.length > 0) {
        this.isSearchFocused = false;
        this.selectedIndex = 0;
      }
      return;
    }

    if (key.name === "backspace") {
      this.query = this.query.slice(0, -1);
      this.historyIndex = -1;
      this.selectedSuggestion = -1;
      this.updateSuggestions();
      return;
    }

    if (str && str.length === 1 && !key.ctrl && !key.meta) {
      this.query += str;
      this.historyIndex = -1;
      this.selectedSuggestion = -1;
      this.updateSuggestions();
    }
  }

  private handleNavigationInput(str: string | undefined, key: readline.Key) {
    if (key.name === "up" || str === "k") {
      if (this.selectedIndex > 0) {
        this.selectedIndex--;
      } else {
        this.isSearchFocused = true;
      }
      return;
    }

    if (key.name === "down" || str === "j") {
      if (this.selectedIndex < this.results.length - 1) {
        this.selectedIndex++;
      }
      return;
    }

    if (key.name === "pageup") {
      this.selectedIndex = Math.max(0, this.selectedIndex - 6);
      return;
    }

    if (key.name === "pagedown") {
      this.selectedIndex = Math.min(this.results.length - 1, this.selectedIndex + 6);
      return;
    }

    if (str === "/" || str === "s") {
      this.isSearchFocused = true;
      return;
    }

    if (str === "t") {
      // Cycle category filter
      this.activeCategoryIndex = (this.activeCategoryIndex + 1) % this.categories.length;
      const cat = this.categories[this.activeCategoryIndex];
      this.showToast(`Category filter: ${cat.toUpperCase()}`);
      if (this.query.trim()) this.executeSearch();
      return;
    }

    if (str === "r") {
      // Open Reader Mode
      const selected = this.results[this.selectedIndex];
      if (selected) {
        this.openReaderMode(selected.url, selected.title);
      }
      return;
    }

    if (key.name === "return") {
      const selected = this.results[this.selectedIndex];
      if (selected) {
        this.openUrl(selected.url);
      }
      return;
    }

    if (str === "c") {
      const selected = this.results[this.selectedIndex];
      if (selected) {
        this.copyToClipboard(selected.url);
      }
      return;
    }

    if (str === "e") {
      this.exportJson();
      return;
    }

    if (str === "m") {
      this.exportMarkdown();
      return;
    }

    if (str === "p") {
      this.showPreview = !this.showPreview;
      return;
    }
  }

  private handleReaderInput(str: string | undefined, key: readline.Key) {
    if (str === "q" || key.name === "escape" || key.name === "backspace") {
      this.viewMode = "search";
      return;
    }

    if (key.name === "up" || str === "k") {
      this.readerScroll = Math.max(0, this.readerScroll - 1);
      return;
    }

    if (key.name === "down" || str === "j") {
      this.readerScroll = Math.min(Math.max(0, this.readerContent.length - 10), this.readerScroll + 1);
      return;
    }

    if (key.name === "pageup") {
      this.readerScroll = Math.max(0, this.readerScroll - 15);
      return;
    }

    if (key.name === "pagedown" || str === " ") {
      this.readerScroll = Math.min(Math.max(0, this.readerContent.length - 10), this.readerScroll + 15);
      return;
    }

    if (str === "o") {
      this.openUrl(this.readerUrl);
      return;
    }

    if (str === "c") {
      this.copyToClipboard(this.readerUrl);
      return;
    }
  }

  private async executeSearch() {
    this.isSearching = true;
    this.statusMessage = `Searching across providers...`;
    this.render();

    try {
      const cat = this.categories[this.activeCategoryIndex];
      const categoriesOpt = cat === "all" ? undefined : [cat];

      const res: SearchResponse = await this.engine.searchWithResponse(this.query, {
        limit: 25,
        categories: categoriesOpt
      });

      this.results = res.results;
      this.instantAnswer = res.instantAnswer;
      this.selectedIndex = 0;
      this.isSearchFocused = false;
      this.suggestions = [];
      this.historyList = getHistoryEntries();
      this.statusMessage = `Found ${res.count} results in ${res.latencyMs || 0}ms.`;
    } catch (err: any) {
      this.statusMessage = `Search failed: ${err.message}`;
    } finally {
      this.isSearching = false;
      this.render();
    }
  }

  private async openReaderMode(url: string, title: string) {
    this.viewMode = "reader";
    this.readerTitle = title;
    this.readerUrl = url;
    this.readerScroll = 0;
    this.isReaderLoading = true;
    this.render();

    try {
      const page = await this.engine.fetchPage(url, 30000);
      this.readerTitle = page.title || title;
      this.readerContent = page.markdown.split("\n");
    } catch (err: any) {
      this.readerContent = [`Error loading content: ${err.message}`, "", `URL: ${url}`];
    } finally {
      this.isReaderLoading = false;
      this.render();
    }
  }

  private openUrl(url: string) {
    const cmd = process.platform === "darwin" ? "open" :
                process.platform === "win32" ? "start" : "xdg-open";
    exec(`${cmd} "${url}"`, () => {});
    this.showToast(`Opened in browser: ${url.slice(0, 30)}...`);
  }

  private copyToClipboard(text: string) {
    try {
      if (process.platform === "darwin") {
        exec(`printf "${text}" | pbcopy`);
      } else if (process.platform === "win32") {
        exec(`clip`);
      } else {
        exec(`printf "${text}" | xclip -selection clipboard 2>/dev/null || printf "${text}" | wl-copy 2>/dev/null`);
      }
      this.showToast(`Copied URL to clipboard!`);
    } catch {
      this.showToast(`URL: ${text.slice(0, 35)}...`);
    }
  }

  private exportJson() {
    try {
      const fileName = `wander-results-${Date.now()}.json`;
      fs.writeFileSync(fileName, JSON.stringify(this.results, null, 2), "utf-8");
      this.showToast(`Saved to ${fileName}`);
    } catch (err: any) {
      this.showToast(`Export failed: ${err.message}`);
    }
  }

  private exportMarkdown() {
    try {
      const fileName = `wander-results-${Date.now()}.md`;
      const mdLines: string[] = [`# Wander Search: "${this.query}"\n`];
      this.results.forEach((r, i) => {
        mdLines.push(`### ${i + 1}. [${r.title}](${r.url})\n**Source:** ${r.source} | **Score:** ${r.score}\n\n${r.snippet}\n`);
      });
      fs.writeFileSync(fileName, mdLines.join("\n"), "utf-8");
      this.showToast(`Saved to ${fileName}`);
    } catch (err: any) {
      this.showToast(`Export failed: ${err.message}`);
    }
  }

  private render() {
    const width = process.stdout.columns || 80;
    const height = process.stdout.rows || 24;

    if (this.viewMode === "reader") {
      this.renderReader(width, height);
    } else {
      this.renderSearch(width, height);
    }
  }

  private renderReader(width: number, height: number) {
    const bold = "\x1b[1m";
    const dim = "\x1b[2m";
    const cyan = "\x1b[36m";
    const green = "\x1b[32m";
    const yellow = "\x1b[33m";
    const inverse = "\x1b[7m";
    const reset = "\x1b[0m";

    let buffer = "\x1b[H";

    // Reader Header
    const titleBar = ` 📖 READER MODE: ${sanitizeForTerminal(this.readerTitle).slice(0, width - 25)} `;
    buffer += `${inverse}${bold}${titleBar.padEnd(width)}${reset}\n`;
    buffer += `${dim}Source: ${green}${this.readerUrl.slice(0, width - 10)}${reset}\n`;
    buffer += `${dim}${"═".repeat(width)}${reset}\n`;

    const bodyHeight = height - 5;

    if (this.isReaderLoading) {
      buffer += `\n   ${yellow}⏳ Extracting clean readable content & stripping ads...${reset}\n\n`;
    } else {
      const visibleLines = this.readerContent.slice(this.readerScroll, this.readerScroll + bodyHeight);
      for (const line of visibleLines) {
        if (line.startsWith("# ")) {
          buffer += `${bold}${cyan}${sanitizeForTerminal(line).slice(0, width)}${reset}\n`;
        } else if (line.startsWith("## ")) {
          buffer += `${bold}${green}${sanitizeForTerminal(line).slice(0, width)}${reset}\n`;
        } else if (line.startsWith("> ")) {
          buffer += `${dim}${sanitizeForTerminal(line).slice(0, width)}${reset}\n`;
        } else {
          buffer += `${sanitizeForTerminal(line).slice(0, width)}\n`;
        }
      }
    }

    const currentLines = buffer.split("\n").length;
    if (currentLines < height - 1) {
      buffer += "\n".repeat(height - 1 - currentLines);
    }

    // Reader Footer
    const totalLines = this.readerContent.length;
    const progress = totalLines > 0 ? Math.round(((this.readerScroll + bodyHeight) / totalLines) * 100) : 0;
    const footerHelp = `[↑/↓/Space] Scroll  [o] Browser  [c] Copy  [q/Esc] Back to Search`;
    const footerText = ` Progress: ${Math.min(100, progress)}% | Line ${this.readerScroll + 1}/${totalLines} `;
    buffer += `\n${inverse}${footerText.padEnd(width - footerHelp.length)}${footerHelp}${reset}`;

    process.stdout.write(buffer);
  }

  private renderSearch(width: number, height: number) {
    const bold = "\x1b[1m";
    const dim = "\x1b[2m";
    const cyan = "\x1b[36m";
    const green = "\x1b[32m";
    const yellow = "\x1b[33m";
    const magenta = "\x1b[35m";
    const inverse = "\x1b[7m";
    const reset = "\x1b[0m";

    let buffer = "\x1b[H";

    // App Header Bar
    const modeBadge = `[Mode: ${this.config.hosting.mode.toUpperCase()}]`;
    const catTabs = this.categories.map((c, i) =>
      i === this.activeCategoryIndex ? `${inverse} ${c.toUpperCase()} ${reset}` : `${dim} ${c.toUpperCase()} ${reset}`
    ).join(" ");

    const appBanner = `  🌐 WANDER SEARCH  ${modeBadge}  ${catTabs}`;
    buffer += `${inverse}${bold}${appBanner.padEnd(width)}${reset}\n`;

    // Search Query Box
    const cursor = this.isSearchFocused ? "█" : "";
    const prefix = this.isSearchFocused ? `${cyan}${bold}▶ Search:${reset} ` : `  ${dim}Search:${reset} `;
    buffer += `\n${prefix}${this.query}${cyan}${cursor}${reset}\n`;

    // Live Query Suggestions Bar
    if (this.suggestions.length > 0 && this.isSearchFocused) {
      const sugList = this.suggestions.map((s, idx) =>
        idx === this.selectedSuggestion ? `${inverse} ${s} ${reset}` : `${dim}[${s}]${reset}`
      ).join("  ");
      buffer += `   ${dim}Suggestions:${reset} ${sugList}\n`;
    } else {
      buffer += `${dim}${"─".repeat(width)}${reset}\n`;
    }

    // Instant Answer Knowledge Box if present
    if (this.instantAnswer) {
      buffer += `╭─ ${bold}${yellow}★ ${this.instantAnswer.title}${reset} ${"─".repeat(Math.max(0, width - this.instantAnswer.title.length - 8))}╮\n`;
      buffer += `│  ${bold}${cyan}${this.instantAnswer.answer}${reset}`;
      if (this.instantAnswer.details) buffer += `  ${dim}(${this.instantAnswer.details})${reset}`;
      buffer += "\n╰" + "─".repeat(width - 2) + "╯\n";
    }

    // Dual-Pane or Single-Pane Layout
    const isSplit = width >= 90 && this.showPreview;
    const leftWidth = isSplit ? Math.floor(width * 0.55) : width;
    const rightWidth = isSplit ? width - leftWidth - 3 : 0;
    const bodyHeight = height - (this.instantAnswer ? 12 : 9);

    const pageSize = Math.max(3, Math.floor(bodyHeight / 3));
    const startIdx = Math.floor(this.selectedIndex / pageSize) * pageSize;
    const visibleResults = this.results.slice(startIdx, startIdx + pageSize);

    if (this.isSearching) {
      buffer += `\n   ${yellow}⏳ Fan-out query across distributed providers...${reset}\n\n`;
    } else if (this.results.length === 0) {
      if (this.query.length === 0) {
        buffer += `\n   ${dim}Type your query above and press Enter to search.${reset}\n`;
        buffer += `   ${dim}Search Operators: site:xyz.com, category:tech, "exact phrase", -exclude${reset}\n`;
        buffer += `   ${dim}Shortcuts: [t] Category Tab  [↑/↓] History  [r] Reader  [Enter] Open  [c] Copy${reset}\n\n`;
      } else {
        buffer += `\n   ${yellow}No ranked results found for "${this.query}". Try alternate keywords.${reset}\n\n`;
      }
    } else if (!isSplit) {
      // Single pane rendering
      visibleResults.forEach((item, relIdx) => {
        const absIdx = startIdx + relIdx;
        const isSelected = absIdx === this.selectedIndex && !this.isSearchFocused;
        const selector = isSelected ? `${cyan}${bold}❯ ` : "  ";
        const titleStyle = isSelected ? `${inverse}${bold}` : `${bold}${cyan}`;
        const sourceBadge = `${magenta}[${item.source}]${reset}`;

        buffer += `${selector}${titleStyle}${absIdx + 1}. ${sanitizeForTerminal(item.title).slice(0, width - 25)}${reset} ${sourceBadge}\n`;
        buffer += `     ${green}${item.url.slice(0, width - 8)}${reset}\n`;
        buffer += `     ${dim}${sanitizeForTerminal(item.snippet).slice(0, width - 8)}${reset}\n`;
      });
    } else {
      // Dual-pane split rendering
      const leftLines: string[] = [];
      visibleResults.forEach((item, relIdx) => {
        const absIdx = startIdx + relIdx;
        const isSelected = absIdx === this.selectedIndex && !this.isSearchFocused;
        const selector = isSelected ? `${cyan}❯ ` : "  ";
        const titleStyle = isSelected ? `${inverse}${bold}` : `${bold}${cyan}`;
        const sourceBadge = `${magenta}[${item.source}]${reset}`;

        leftLines.push(`${selector}${titleStyle}${absIdx + 1}. ${sanitizeForTerminal(item.title).slice(0, leftWidth - 20)}${reset} ${sourceBadge}`);
        leftLines.push(`   ${green}${item.url.slice(0, leftWidth - 6)}${reset}`);
        leftLines.push(`   ${dim}${sanitizeForTerminal(item.snippet).slice(0, leftWidth - 6)}${reset}`);
        leftLines.push("");
      });

      // Right pane: Selected Result Detail & Preview
      const rightLines: string[] = [];
      const selected = this.results[this.selectedIndex];
      if (selected) {
        rightLines.push(`${bold}${cyan}${sanitizeForTerminal(selected.title).slice(0, rightWidth)}${reset}`);
        rightLines.push(`${dim}${"─".repeat(rightWidth)}${reset}`);
        rightLines.push(`${green}${selected.url.slice(0, rightWidth)}${reset}`);
        rightLines.push(`${magenta}Source:${reset} ${selected.source}  ${yellow}Score:${reset} ${selected.score}`);
        if (selected.publishedDate) rightLines.push(`${dim}Date: ${selected.publishedDate}${reset}`);
        if (selected.author) rightLines.push(`${dim}Author: ${selected.author}${reset}`);
        rightLines.push("");
        rightLines.push(`${bold}Snippet:${reset}`);

        // Word-wrap snippet for right pane
        const words = sanitizeForTerminal(selected.snippet).split(" ");
        let line = "";
        for (const w of words) {
          if ((line + " " + w).length > rightWidth) {
            rightLines.push(line);
            line = w;
          } else {
            line = line ? line + " " + w : w;
          }
        }
        if (line) rightLines.push(line);

        rightLines.push("");
        rightLines.push(`${dim}[r] Reader Mode  [Enter] Open Link  [c] Copy URL${reset}`);
      }

      // Combine columns with vertical divider
      const maxRows = Math.max(leftLines.length, rightLines.length);
      for (let r = 0; r < maxRows; r++) {
        const left = (leftLines[r] || "").padEnd(leftWidth);
        const right = rightLines[r] || "";
        buffer += `${left} ${dim}│${reset} ${right}\n`;
      }
    }

    // Fill remaining screen lines
    const currentLines = buffer.split("\n").length;
    if (currentLines < height - 1) {
      buffer += "\n".repeat(height - 1 - currentLines);
    }

    // Bottom Navigation Bar & Toast
    const toastDisplay = this.toastMessage ? `${yellow}${bold} ${this.toastMessage} ${reset} ` : "";
    const navShortcuts = this.isSearchFocused
      ? `[Enter] Search  [Tab] Suggest  [↑/↓] History  [Ctrl+C] Exit`
      : `[↑/↓] Select  [Enter] Open  [r] Reader  [t] Category  [c] Copy  [e] JSON  [m] MD  [q] Quit`;

    buffer += `\n${inverse} ${this.statusMessage.slice(0, 35).padEnd(35)} ${toastDisplay}${navShortcuts.padStart(width - 38 - toastDisplay.length)} ${reset}`;

    process.stdout.write(buffer);
  }
}
