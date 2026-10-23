import { SearchResult, FetchedContent, ResearchFinding, ProviderStatus, WanderConfig } from "../core/types.js";
import { sanitizeForTerminal } from "../core/security.js";

// ANSI escape styling helpers
const reset = "\x1b[0m";
const bold = "\x1b[1m";
const dim = "\x1b[2m";
const cyan = "\x1b[36m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const blue = "\x1b[34m";
const magenta = "\x1b[35m";
const red = "\x1b[31m";

export function formatResultList(results: SearchResult[], json = false): string {
  if (json) {
    return JSON.stringify(results, null, 2);
  }

  if (results.length === 0) {
    return `${yellow}No search results found.${reset}`;
  }

  const out: string[] = [];
  out.push(`${bold}Found ${results.length} ranked results:${reset}\n`);

  results.forEach((item, idx) => {
    const num = `${dim}${idx + 1}.${reset}`;
    const sourceBadge = `${magenta}[${item.source}]${reset}`;
    const title = `${bold}${cyan}${sanitizeForTerminal(item.title)}${reset}`;
    const score = `${dim}(score: ${item.score})${reset}`;
    const url = `${green}${item.url}${reset}`;
    const snippet = item.snippet ? `${sanitizeForTerminal(item.snippet)}` : `${dim}(no snippet available)${reset}`;

    out.push(`${num} ${title} ${sourceBadge} ${score}`);
    out.push(`   ${url}`);
    out.push(`   ${snippet}\n`);
  });

  return out.join("\n");
}

export function formatFetchedContent(content: FetchedContent, json = false): string {
  if (json) {
    return JSON.stringify(content, null, 2);
  }

  const out: string[] = [];
  out.push(`${bold}${cyan}# ${content.title}${reset}`);
  out.push(`${green}URL:${reset} ${content.url}`);
  if (content.siteName) out.push(`${dim}Site: ${content.siteName}${reset}`);
  if (content.byline) out.push(`${dim}Author: ${content.byline}${reset}`);
  out.push(`${dim}Fetched: ${content.fetchedAt} (${content.length.toLocaleString()} chars)${reset}`);
  if (content.isTruncated) out.push(`${yellow}Note: Content truncated to size limit.${reset}`);
  out.push("\n---\n");
  out.push(content.markdown);

  return out.join("\n");
}

export function formatResearchFinding(finding: ResearchFinding, json = false): string {
  if (json) {
    return JSON.stringify(finding, null, 2);
  }

  const out: string[] = [];
  out.push(`${bold}🔍 Research Synthesis: ${cyan}"${finding.topic}"${reset}\n`);
  out.push(`${bold}Overview:${reset}`);
  out.push(`${finding.summary}\n`);

  if (finding.keyInsights.length > 0) {
    out.push(`${bold}Key Insights:${reset}`);
    for (const insight of finding.keyInsights) {
      out.push(`  • ${insight}`);
    }
    out.push("");
  }

  if (finding.sources.length > 0) {
    out.push(`${bold}Primary Sources & References:${reset}`);
    finding.sources.forEach((s, i) => {
      out.push(`  [${i + 1}] ${cyan}${s.title}${reset}`);
      out.push(`      ${green}${s.url}${reset}`);
      if (s.keyTakeaway) out.push(`      ${dim}${s.keyTakeaway}${reset}`);
    });
  }

  return out.join("\n");
}

export function formatDoctorReport(providers: ProviderStatus[], config: WanderConfig): string {
  const out: string[] = [];
  out.push(`\n${bold}🩺 Wander Search Engine Diagnostic & Health Check${reset}\n`);

  // Hosting mode
  const mode = config.hosting.mode;
  out.push(`${bold}Hosting Configuration:${reset}`);
  out.push(`  Mode: ${cyan}${mode.toUpperCase()}${reset}`);
  if (mode === "cloudflare") {
    out.push(`  Worker Endpoint: ${green}${config.hosting.cloudflare?.workerUrl || "Not configured"}${reset}`);
    out.push(`  Deployed At: ${dim}${config.hosting.cloudflare?.deployedAt || "Unknown"}${reset}`);
  } else {
    out.push(`  Direct In-Process Mode: ${cyan}${config.hosting.local?.directMode ? "Enabled (Zero latency)" : "Disabled"}${reset}`);
    out.push(`  Local Daemon Port: ${dim}${config.hosting.local?.port || 8448}${reset}`);
  }

  // Provider health table
  out.push(`\n${bold}Provider Health & Latency:${reset}`);
  providers.forEach(p => {
    const statusMark = p.isAvailable ? `${green}✓ Online ${reset}` : `${red}✗ Offline${reset}`;
    const latency = p.latencyMs !== undefined ? `${dim}(${p.latencyMs}ms)${reset}` : "";
    const keyInfo = p.requiresKey ? (p.hasKey ? `${green}[Key Present]${reset}` : `${yellow}[Key Missing]${reset}`) : `${dim}[Free / No Key]${reset}`;
    const errInfo = p.lastError ? ` - ${red}${p.lastError}${reset}` : "";

    out.push(`  ${statusMark} ${bold}${p.name.padEnd(14)}${reset} ${p.category.padEnd(8)} ${keyInfo.padEnd(20)} ${latency}${errInfo}`);
  });

  // Environment checks
  out.push(`\n${bold}Environment Checks:${reset}`);
  out.push(`  Node.js: ${green}${process.version}${reset}`);
  out.push(`  Platform: ${cyan}${process.platform} (${process.arch})${reset}`);
  out.push(`  Config File: ${dim}~/.config/wander/config.json${reset}`);
  out.push(`  Cache: ${dim}~/.cache/wander/wander_cache.db (SQLite)${reset}`);

  return out.join("\n");
}
