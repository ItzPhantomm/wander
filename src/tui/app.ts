import readline from "node:readline";
import fs from "node:fs";
import { exec } from "node:child_process";
import { SearchEngine } from "../core/engine.js";
import { SearchResult, SearchResponse, InstantAnswer, WanderConfig } from "../core/types.js";
import { sanitizeForTerminal } from "../core/security.js";
import { getQuerySuggestions } from "../core/suggestions.js";
import { getHistoryEntries } from "../core/history.js";

type TuiView = "search" | "reader";

function wrapText(text: string, maxWidth: number): string[] {
  if (maxWidth <= 10) return [text.slice(0, maxWidth)];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!w) continue;
    if ((current + " " + w).trim().length > maxWidth) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = current ? current + " " + w : w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export class WanderTUI {
  private engine: SearchEngine;
  private config: WanderConfig;
  private query = "";
  private results: SearchResult[] = [];
  private selectedIndex = 0;
  private isSearching = false;
  private statusMessage = "Type a query and press Enter to search";
  private toastMessage = "";
  private toastTimer: any = null;
  private isSearchFocused = true;
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

      // Global Exit: Ctrl+C anytime, or q/Esc when not typing in search box
      if (
        (key.ctrl && key.name === "c") ||
        (key.name === "escape" && this.viewMode === "search" && !this.isSearchFocused) ||
        (str === "q" && this.viewMode === "search" && !this.isSearchFocused)
      ) {
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

    if (key.name === "escape") {
      if (this.suggestions.length > 0) {
        this.suggestions = [];
        this.selectedSuggestion = -1;
      } else if (this.results.length > 0) {
        this.isSearchFocused = false;
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
      if (this.suggestions.length > 0 && this.selectedSuggestion < this.suggestions.length - 1) {
        this.selectedSuggestion++;
        this.query = this.suggestions[this.selectedSuggestion];
      } else if (this.historyIndex > 0) {
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
      this.selectedIndex = Math.max(0, this.selectedIndex - 5);
      return;
    }

    if (key.name === "pagedown") {
      this.selectedIndex = Math.min(this.results.length - 1, this.selectedIndex + 5);
      return;
    }

    if (str === "/" || str === "s" || key.name === "escape") {
      this.isSearchFocused = true;
      return;
    }

    // Direct category switching via numbers 1, 2, 3, 4
    if (str === "1") {
      this.setCategoryIndex(0);
      return;
    }
    if (str === "2") {
      this.setCategoryIndex(1);
      return;
    }
    if (str === "3") {
      this.setCategoryIndex(2);
      return;
    }
    if (str === "4") {
      this.setCategoryIndex(3);
      return;
    }

    if (str === "t") {
      // Cycle category filter
      this.setCategoryIndex((this.activeCategoryIndex + 1) % this.categories.length);
      return;
    }

    if (str === "r" || str === " ") {
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
  }

  private setCategoryIndex(index: number) {
    this.activeCategoryIndex = index;
    const cat = this.categories[this.activeCategoryIndex];
    this.showToast(`Category filter: ${cat.toUpperCase()}`);
    if (this.query.trim()) this.executeSearch();
  }

  private handleReaderInput(str: string | undefined, key: readline.Key) {
    if (str === "q" || key.name === "escape" || key.name === "backspace" || str === "r") {
      this.viewMode = "search";
      return;
    }

    if (key.name === "up" || str === "k") {
      this.readerScroll = Math.max(0, this.readerScroll - 1);
      return;
    }

    if (key.name === "down" || str === "j") {
      this.readerScroll = Math.min(Math.max(0, this.readerContent.length - 8), this.readerScroll + 1);
      return;
    }

    if (key.name === "pageup" || str === "b") {
      this.readerScroll = Math.max(0, this.readerScroll - 15);
      return;
    }

    if (key.name === "pagedown" || str === " " || str === "f") {
      this.readerScroll = Math.min(Math.max(0, this.readerContent.length - 8), this.readerScroll + 15);
      return;
    }

    if (str === "g" || key.name === "home") {
      this.readerScroll = 0;
      return;
    }

    if (str === "G" || key.name === "end") {
      this.readerScroll = Math.max(0, this.readerContent.length - 15);
      return;
    }

    if (str === "o" || key.name === "return") {
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
    this.statusMessage = `Searching across distributed engines...`;
    this.render();

    try {
      const cat = this.categories[this.activeCategoryIndex];
      const categoriesOpt = cat === "all" ? undefined : [cat];

      const res: SearchResponse = await this.engine.searchWithResponse(this.query, {
        limit: 25,
        categories: categoriesOpt,
      });

      this.results = res.results;
      this.instantAnswer = res.instantAnswer;
      this.selectedIndex = 0;
      this.isSearchFocused = false;
      this.suggestions = [];
      this.historyList = getHistoryEntries();
      this.statusMessage = `Found ${res.count} results in ${res.latencyMs || 0}ms`;
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
    const cmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
        ? "start"
        : "xdg-open";
    exec(`${cmd} "${url}"`, () => {});
    this.showToast(`Opening browser: ${url.slice(0, 32)}...`);
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
      this.showToast(`✔ Saved JSON: ${fileName}`);
    } catch (err: any) {
      this.showToast(`Export error: ${err.message}`);
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
      this.showToast(`✔ Saved Markdown: ${fileName}`);
    } catch (err: any) {
      this.showToast(`Export error: ${err.message}`);
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

  // =========================================================================
  // READER VIEW: Full-width, clean typography, distraction-free reading
  // =========================================================================
  private renderReader(width: number, height: number) {
    const bold = "\x1b[1m";
    const dim = "\x1b[2m";
    const cyan = "\x1b[36m";
    const green = "\x1b[32m";
    const yellow = "\x1b[33m";
    const inverse = "\x1b[7m";
    const reset = "\x1b[0m";

    let buffer = "\x1b[H";

    // Reader Header Bar
    const titleBar = ` 📖 READER: ${sanitizeForTerminal(this.readerTitle).slice(0, width - 20)} `;
    buffer += `${inverse}${bold}${titleBar.padEnd(width)}${reset}\n`;
    buffer += `${dim} Source: ${green}${this.readerUrl.slice(0, width - 12)}${reset}\n`;
    buffer += `${dim}${"─".repeat(width)}${reset}\n`;

    const bodyHeight = height - 5;

    if (this.isReaderLoading) {
      buffer += `\n   ${yellow}⏳ Extracting clean readable article and stripping page clutter...${reset}\n\n`;
    } else {
      const visibleLines = this.readerContent.slice(this.readerScroll, this.readerScroll + bodyHeight);
      for (const rawLine of visibleLines) {
        const line = sanitizeForTerminal(rawLine);
        if (line.startsWith("# ")) {
          buffer += `\n${bold}${cyan}${line.slice(0, width - 2)}${reset}\n`;
        } else if (line.startsWith("## ")) {
          buffer += `\n${bold}${green}${line.slice(0, width - 2)}${reset}\n`;
        } else if (line.startsWith("### ")) {
          buffer += `${bold}${line.slice(0, width - 2)}${reset}\n`;
        } else if (line.startsWith("> ")) {
          buffer += `  ${dim}│ ${line.slice(2, width - 6)}${reset}\n`;
        } else if (line.trim().length === 0) {
          buffer += "\n";
        } else {
          // Soft wrap paragraphs
          const wrapped = wrapText(line, width - 4);
          for (const w of wrapped) {
            buffer += `  ${w}\n`;
          }
        }
      }
    }

    const currentLines = buffer.split("\n").length;
    if (currentLines < height - 1) {
      buffer += "\n".repeat(height - 1 - currentLines);
    }

    // Reader Progress & Shortcuts
    const totalLines = this.readerContent.length;
    const progress = totalLines > 0 ? Math.min(100, Math.round(((this.readerScroll + bodyHeight) / totalLines) * 100)) : 0;
    const footerHelp = `[↑/↓/Space] Scroll  [o] Browser  [c] Copy URL  [q/Esc] Back `;
    const progressBadge = ` [${progress}% • Line ${this.readerScroll + 1}/${totalLines}] `;
    const leftPad = progressBadge;
    const spacer = " ".repeat(Math.max(1, width - leftPad.length - footerHelp.length));

    buffer += `\n${inverse}${leftPad}${spacer}${footerHelp}${reset}`;
    process.stdout.write(buffer);
  }

  // =========================================================================
  // SEARCH VIEW: Unified, Spacious, Elegant & Highly User-Friendly (No Dual Mode)
  // =========================================================================
  private renderSearch(width: number, height: number) {
    const bold = "\x1b[1m";
    const dim = "\x1b[2m";
    const cyan = "\x1b[36m";
    const brightCyan = "\x1b[96m";
    const green = "\x1b[32m";
    const yellow = "\x1b[33m";
    const magenta = "\x1b[35m";
    const brightWhite = "\x1b[97m";
    const inverse = "\x1b[7m";
    const reset = "\x1b[0m";

    let buffer = "\x1b[H";

    // 1. Top Brand Banner
    const brand = ` 🌐 WANDER `;
    const modeBadge = `[${this.config.hosting.mode.toUpperCase()}]`;
    const tag = `Open-Source Search for Humans & AI`;
    const rightInfo = `${modeBadge}  `;
    const topBar = `${inverse}${bold}${brand}${reset} ${dim}${tag}${reset}`;
    const topPadding = Math.max(1, width - brand.length - tag.length - rightInfo.length - 2);
    buffer += `${topBar}${" ".repeat(topPadding)}${dim}${rightInfo}${reset}\n`;

    // 2. Category Tabs
    const catLabels = [
      { key: "1", name: "ALL" },
      { key: "2", name: "TECH" },
      { key: "3", name: "CODE" },
      { key: "4", name: "SCIENCE" },
    ];
    let tabLine = `  ${dim}Categories:${reset} `;
    catLabels.forEach((c, idx) => {
      const isActive = idx === this.activeCategoryIndex;
      if (isActive) {
        tabLine += `${inverse}${bold} ${c.key} ${c.name} ${reset}  `;
      } else {
        tabLine += `${dim}[${c.key} ${c.name}]${reset}  `;
      }
    });
    buffer += `${tabLine}\n`;

    // 3. Search Query Input Box
    const searchBorderColor = this.isSearchFocused ? brightCyan : dim;
    const searchBoxWidth = width - 4;
    const innerWidth = searchBoxWidth - 4;
    
    buffer += `  ${searchBorderColor}╭${"─".repeat(searchBoxWidth - 2)}╮${reset}\n`;

    let displayText = this.query;
    if (displayText.length === 0 && this.isSearchFocused) {
      displayText = `${dim}Type search query, math ("25 * 4"), or site:domain.com...${reset}`;
    }
    const cursor = this.isSearchFocused ? `${brightCyan}█${reset}` : "";
    const prompt = this.isSearchFocused ? `${bold}${brightCyan} › ${reset}` : `   `;
    
    // Ensure display text fits inside the box
    const cleanDisplay = sanitizeForTerminal(this.query);
    const visibleQuery = cleanDisplay.length > innerWidth - 5
      ? "..." + cleanDisplay.slice(-(innerWidth - 8))
      : cleanDisplay;

    if (this.query.length === 0 && this.isSearchFocused) {
      buffer += `  ${searchBorderColor}│${reset}${prompt}${displayText}${cursor}${" ".repeat(Math.max(0, innerWidth - 48))}${searchBorderColor}│${reset}\n`;
    } else {
      const padRight = Math.max(0, innerWidth - visibleQuery.length - 2);
      buffer += `  ${searchBorderColor}│${reset}${prompt}${bold}${brightWhite}${visibleQuery}${reset}${cursor}${" ".repeat(padRight)}${searchBorderColor}│${reset}\n`;
    }
    buffer += `  ${searchBorderColor}╰${"─".repeat(searchBoxWidth - 2)}╯${reset}\n`;

    // 4. Autocomplete Suggestion Dropdown (if active)
    let usedLines = 6;
    if (this.suggestions.length > 0 && this.isSearchFocused) {
      buffer += `    ${dim}Suggestions (Tab or ↓ to pick):${reset} `;
      this.suggestions.forEach((sug, idx) => {
        const isSel = idx === this.selectedSuggestion;
        if (isSel) {
          buffer += `${inverse}${bold} ${sug} ${reset} `;
        } else {
          buffer += `${cyan}[${sug}]${reset} `;
        }
      });
      buffer += "\n";
      usedLines++;
    }

    // 5. Instant Answer Card (if present)
    if (this.instantAnswer) {
      const ansTitle = ` ★ ${this.instantAnswer.title} `;
      buffer += `  ${yellow}╭─${bold}${ansTitle}${reset}${yellow}${"─".repeat(Math.max(0, width - ansTitle.length - 6))}╮${reset}\n`;
      buffer += `  ${yellow}│${reset}  ${bold}${brightWhite}${this.instantAnswer.answer}${reset}`;
      if (this.instantAnswer.details) {
        buffer += `  ${dim}(${this.instantAnswer.details})${reset}`;
      }
      buffer += "\n";
      buffer += `  ${yellow}╰${"─".repeat(width - 6)}╯${reset}\n`;
      usedLines += 3;
    }

    // 6. Search Results Area (Single Pane, Spacious & Full-Width)
    const availableHeight = height - usedLines - 2;

    if (this.isSearching) {
      buffer += `\n   ${yellow}⏳ Fanning out queries across distributed search providers...${reset}\n`;
      buffer += `   ${dim}Aggregating DuckDuckGo, Wikipedia, GitHub, Hacker News & arXiv...${reset}\n\n`;
    } else if (this.results.length === 0) {
      if (this.query.length === 0) {
        // Helpful, attractive initial welcome guide
        buffer += `\n  ${dim}╭── QUICK GUIDE ─────────────────────────────────────────────────────────────╮${reset}\n`;
        buffer += `  ${dim}│${reset}  ${bold}Search Syntax:${reset}                                                          ${dim}│${reset}\n`;
        buffer += `  ${dim}│${reset}    • ${cyan}site:github.com${reset}         Restrict results to a specific domain        ${dim}│${reset}\n`;
        buffer += `  ${dim}│${reset}    • ${cyan}category:code${reset}           Filter by engine category (web, code, tech)  ${dim}│${reset}\n`;
        buffer += `  ${dim}│${reset}    • ${cyan}"exact phrase"${reset}          Enforce exact word sequence                  ${dim}│${reset}\n`;
        buffer += `  ${dim}│${reset}    • ${cyan}-exclude${reset}                Exclude unwanted keywords                    ${dim}│${reset}\n`;
        buffer += `  ${dim}│${reset}    • ${cyan}25 * 4 + 10${reset}             Instant math calculation                     ${dim}│${reset}\n`;
        buffer += `  ${dim}│${reset}    • ${cyan}50 km to miles${reset}          Instant unit conversion                      ${dim}│${reset}\n`;
        buffer += `  ${dim}│${reset}                                                                             ${dim}│${reset}\n`;
        buffer += `  ${dim}│${reset}  ${bold}Shortcuts:${reset}                                                              ${dim}│${reset}\n`;
        buffer += `  ${dim}│${reset}    • ${bold}[Enter]${reset} Search/Open       • ${bold}[r]${reset} Reader Mode      • ${bold}[t]${reset} Cycle Tabs        ${dim}│${reset}\n`;
        buffer += `  ${dim}│${reset}    • ${bold}[c]${reset} Copy URL              • ${bold}[e]${reset} Export JSON      • ${bold}[m]${reset} Export Markdown   ${dim}│${reset}\n`;
        buffer += `  ${dim}│${reset}    • ${bold}[↑/↓]${reset} Query History      • ${bold}[/]${reset} Focus Search     • ${bold}[q]${reset} Quit              ${dim}│${reset}\n`;
        buffer += `  ${dim}╰────────────────────────────────────────────────────────────────────────────╯${reset}\n`;
      } else {
        buffer += `\n   ${yellow}No ranked results found for "${this.query}".${reset}\n`;
        buffer += `   ${dim}Try removing operators, using broader keywords, or switching categories.${reset}\n\n`;
      }
    } else {
      // Calculate how many result cards fit comfortably
      // Each card takes ~4 lines (Title+source, URL, Snippet, Divider)
      const cardHeight = 4;
      const pageSize = Math.max(2, Math.floor(availableHeight / cardHeight));
      const pageIndex = Math.floor(this.selectedIndex / pageSize);
      const startIdx = pageIndex * pageSize;
      const visibleResults = this.results.slice(startIdx, startIdx + pageSize);

      visibleResults.forEach((item, relIdx) => {
        const absIdx = startIdx + relIdx;
        const isSelected = absIdx === this.selectedIndex && !this.isSearchFocused;
        
        // Indicator
        const indicator = isSelected ? `${bold}${brightCyan}▶ ` : `  `;
        const numBadge = `${dim}${absIdx + 1}.${reset} `;
        
        // Title styling
        const titleText = sanitizeForTerminal(item.title);
        const maxTitleLen = Math.max(20, width - 35);
        const trimmedTitle = titleText.length > maxTitleLen ? titleText.slice(0, maxTitleLen - 3) + "..." : titleText;
        const titleFormatted = isSelected ? `${inverse}${bold} ${trimmedTitle} ${reset}` : `${bold}${brightWhite}${trimmedTitle}${reset}`;
        
        // Metadata badges
        const sourceBadge = `${magenta}[${item.source}]${reset}`;
        const scoreBadge = `${dim}(score: ${item.score})${reset}`;

        // Line 1: Indicator + Number + Title + Source
        buffer += `${indicator}${numBadge}${titleFormatted}  ${sourceBadge} ${scoreBadge}\n`;

        // Line 2: URL
        const maxUrlLen = Math.max(30, width - 10);
        const urlClean = item.url.length > maxUrlLen ? item.url.slice(0, maxUrlLen - 3) + "..." : item.url;
        buffer += `     ${green}${urlClean}${reset}\n`;

        // Line 3: Snippet (Full-width clean wrap, 1-2 lines)
        const maxSnippetLen = width - 10;
        const snippetClean = sanitizeForTerminal(item.snippet);
        const wrappedSnippet = wrapText(snippetClean, maxSnippetLen);
        const snippetToShow = wrappedSnippet.slice(0, 2);
        for (const snipLine of snippetToShow) {
          buffer += `     ${dim}${snipLine}${reset}\n`;
        }

        // Line 4: Divider
        if (relIdx < visibleResults.length - 1) {
          buffer += `     ${dim}${"┄".repeat(Math.min(width - 10, 72))}${reset}\n`;
        }
      });
    }

    // Fill blank lines up to screen height
    const currentLines = buffer.split("\n").length;
    if (currentLines < height - 1) {
      buffer += "\n".repeat(height - 1 - currentLines);
    }

    // 7. Status & Bottom Navigation Bar
    const totalResults = this.results.length;
    let positionText = "";
    if (totalResults > 0 && !this.isSearchFocused) {
      positionText = `Result ${this.selectedIndex + 1}/${totalResults} | `;
    }

    const toastDisplay = this.toastMessage ? `${bold}${yellow} ✔ ${this.toastMessage} ${reset}` : "";
    const navShortcuts = this.isSearchFocused
      ? `[Enter] Search  [Tab] Autocomplete  [↑/↓] History  [Ctrl+C] Exit`
      : `[Enter] Open  [r] Reader  [t] Category  [c] Copy  [e] JSON  [m] MD  [/] Search  [q] Quit`;

    const leftStatus = ` ${positionText}${this.statusMessage} `;
    const barPadding = Math.max(1, width - leftStatus.length - navShortcuts.length - (this.toastMessage ? this.toastMessage.length + 6 : 0));

    buffer += `\n${inverse}${leftStatus}${toastDisplay}${" ".repeat(barPadding)}${navShortcuts} ${reset}`;
    process.stdout.write(buffer);
  }
}
