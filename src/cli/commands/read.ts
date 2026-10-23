import readline from "node:readline";
import { SearchEngine } from "../../core/engine.js";
import { loadConfig } from "../../hosting/config.js";
import { sanitizeForTerminal } from "../../core/security.js";

export async function runReadCommand(url: string): Promise<void> {
  const config = loadConfig();
  const engine = new SearchEngine(config);

  process.stderr.write(`Extracting readable content from ${url}...\n`);
  const page = await engine.fetchPage(url, 40000);

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    // Non-interactive output
    process.stdout.write(`# ${page.title}\n\n${page.markdown}\n`);
    return;
  }

  // Interactive scrollable reader
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdout.write("\x1b[?1049h\x1b[?25l");

  const lines = page.markdown.split("\n");
  let scroll = 0;

  const render = () => {
    const width = process.stdout.columns || 80;
    const height = process.stdout.rows || 24;
    const bodyHeight = height - 4;

    let buf = "\x1b[H";
    buf += `\x1b[7m\x1b[1m 📖 WANDER READER: ${sanitizeForTerminal(page.title).slice(0, width - 25)} \x1b[0m\n`;
    buf += `\x1b[2mURL: \x1b[32m${url.slice(0, width - 8)}\x1b[0m\n`;
    buf += `\x1b[2m${"─".repeat(width)}\x1b[0m\n`;

    const visible = lines.slice(scroll, scroll + bodyHeight);
    for (const l of visible) {
      if (l.startsWith("# ")) {
        buf += `\x1b[1m\x1b[36m${sanitizeForTerminal(l).slice(0, width)}\x1b[0m\n`;
      } else if (l.startsWith("## ")) {
        buf += `\x1b[1m\x1b[32m${sanitizeForTerminal(l).slice(0, width)}\x1b[0m\n`;
      } else if (l.startsWith("> ")) {
        buf += `\x1b[2m${sanitizeForTerminal(l).slice(0, width)}\x1b[0m\n`;
      } else {
        buf += `${sanitizeForTerminal(l).slice(0, width)}\n`;
      }
    }

    const currentLines = buf.split("\n").length;
    if (currentLines < height - 1) {
      buf += "\n".repeat(height - 1 - currentLines);
    }

    const progress = lines.length > 0 ? Math.round(((scroll + bodyHeight) / lines.length) * 100) : 100;
    const footer = ` Line ${scroll + 1}/${lines.length} (${Math.min(100, progress)}%) | [↑/↓/Space] Scroll  [q/Esc] Exit `;
    buf += `\n\x1b[7m${footer.padEnd(width)}\x1b[0m`;

    process.stdout.write(buf);
  };

  render();

  process.stdin.on("keypress", (str, key) => {
    if (str === "q" || key.name === "escape" || (key.ctrl && key.name === "c")) {
      process.stdout.write("\x1b[?25h\x1b[?1049l");
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.exit(0);
    }

    if (key.name === "up" || str === "k") {
      scroll = Math.max(0, scroll - 1);
      render();
    } else if (key.name === "down" || str === "j") {
      scroll = Math.min(Math.max(0, lines.length - 10), scroll + 1);
      render();
    } else if (key.name === "pageup") {
      scroll = Math.max(0, scroll - 15);
      render();
    } else if (key.name === "pagedown" || str === " ") {
      scroll = Math.min(Math.max(0, lines.length - 10), scroll + 15);
      render();
    }
  });
}
