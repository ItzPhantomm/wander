# 🌐 Wander — Open-Source Search for Humans and AI

> A fast, advanced, completely free and open-source search engine with an interactive terminal UI, robust CLI, and Model Context Protocol (MCP) interface for AI agents and coding harnesses.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-brightgreen.svg)](https://nodejs.org)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)

---

## ⚡ Highlights

- **100% Free & Open-Source**: No paid API keys, subscriptions, or credit cards required.
- **Dual Hosting Modes**:
  - **Local Mode**: Runs entirely on your machine. Zero cloud accounts, zero latency, offline-first SQLite caching.
  - **Cloudflare Mode**: Automatic serverless deployment to Cloudflare Workers using Wrangler (free tier friendly: 100,000 requests/day).
- **Interactive Terminal UI (TUI)**: Keyboard-driven full-screen search interface with live results, preview reader, URL copying, and JSON export.
- **Direct CLI Interface**: Shell-friendly commands with clean pipe support (`--json`).
- **AI Agent & Harness Native**: Built-in stdio MCP server for Claude Code, Cursor, Antigravity, Codex, OpenCode, and any MCP client.
- **Multi-Provider Consensus Ranking**: Combines results from DuckDuckGo, Wikipedia, Hacker News, GitHub, arXiv, SearXNG, and Crossref using Reciprocal Rank Fusion (RRF).
- **Enterprise-Grade Security**: Full SSRF protection, strict redirect inspection, private CIDR filtering, terminal ANSI escape neutralization, and AI prompt-injection fencing.

---

## 🚀 Quick Start

### Installation

```bash
# Clone and link globally
git clone https://github.com/wander-search/wander.git
cd wander
npm install
npm run build
npm link
```

Verify installation:
```bash
wander --version
wander doctor
```

---

## 🛠️ Hosting Modes & Automatic Setup

On your first launch of `wander`, an interactive wizard will guide you through selecting your preferred hosting backend:

1. **Local Mode (Default)**:
   - Zero setup required. Runs directly in-process or as a local daemon.
   - Caches search queries in `~/.cache/wander/wander_cache.db` (SQLite).
2. **Cloudflare Mode**:
   - Deploys your search backend to Cloudflare's global edge network via Wrangler.
   - Automatically builds `cloudflare/worker.ts`, verifies connectivity, and updates your local configuration.

### Switching Hosting Later

You can switch hosting anytime without losing data:

```bash
# Switch to local mode
wander config --mode local

# Switch to an existing Cloudflare Worker backend
wander config --mode cloudflare --worker-url https://wander-backend.yoursubdomain.workers.dev

# Or automatically deploy a new Cloudflare backend
wander deploy
```

> **Safe Rollback**: If a target Cloudflare worker fails health checks during switching, Wander **preserves your existing working configuration** and alerts you safely.

---

## 🖥️ Interactive Terminal UI (TUI)

Launch the interactive search terminal simply by typing:

```bash
wander
```

### Keyboard Shortcuts:
| Key | Action |
|---|---|
| `[Enter]` | Execute search query / Open selected URL in default browser |
| `[↑] / [↓]` | Navigate through ranked search results |
| `[Tab]` | Toggle focus between search box and results |
| `[/]` or `[s]` | Refocus search query box |
| `[c]` | Copy selected URL to clipboard |
| `[j]` | Export results to `wander-results.json` |
| `[p]` | Toggle preview pane |
| `[q]` or `[Esc]` | Exit Wander cleanly |

---

## 💻 CLI Commands

Wander provides dedicated commands for terminal workflows, scripting, and shell pipelines:

### 1. Basic Search
```bash
wander search "Rust async patterns"
wander search "PostgreSQL indexes" --limit 5 --json
```

### 2. Parallel Multi-Facet Search
Queries multiple query variations and facets simultaneously for broad coverage:
```bash
wander parallel "Autonomous AI agent architectures" --limit 10
```

### 3. Autonomous Deep Research
Runs multi-query expansion, retrieves top primary sources, extracts key insights, and synthesizes a brief with citations:
```bash
wander research "Distributed SQLite replication mechanisms"
```

### 4. Safe Webpage Retrieval & Markdown Extractor
Retrieves a page with SSRF protection, strips ads/scripts, and outputs clean Markdown:
```bash
wander fetch "https://en.wikipedia.org/wiki/Search_engine" --max-chars 20000
```

### 5. Diagnostics & Health Check
Checks latency, availability, and rate limits across all search providers:
```bash
wander doctor
```

### 6. Configuration Management
```bash
# View configuration
wander config

# Update settings
wander config --set search.maxResults=20
wander config --set search.timeoutMs=8000
```

---

## 🤖 AI & Harness Integration (MCP Server)

Wander includes a production-ready stdio Model Context Protocol (MCP) server that AI agents can use directly as a web search and retrieval tool.

### Adding Wander to Claude Code / Claude Desktop

In `~/.claude/claude_desktop_config.json` or your project `.mcp.json`:

```json
{
  "mcpServers": {
    "wander": {
      "command": "wander",
      "args": ["mcp"]
    }
  }
}
```

### Adding Wander to Cursor

In Cursor **Settings > Features > MCP**:
- **Name**: `wander`
- **Type**: `command`
- **Command**: `wander mcp`

### Exposed MCP Tools

| Tool | Purpose |
|---|---|
| `wander_search` | Ranked search across distributed providers with consensus ranking |
| `wander_parallel_search` | Parallel search across multiple query facets simultaneously |
| `wander_fetch` | SSRF-safe page retriever and clean Markdown extractor |
| `wander_research` | Autonomous research tool with synthesized takeaways and cited sources |
| `wander_code_search` | Targeted search across GitHub repositories, code, and developer discussions |

> **Clean Stdio Guarantee**: Wander strictly isolates diagnostic logs to `stderr`. `stdout` carries only valid JSON-RPC 2.0 messages.

---

## 🛡️ Security Architecture

1. **SSRF Guard (`src/core/security.ts`)**:
   - Blocks private IPv4 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `0.0.0.0/8`).
   - Blocks cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`).
   - Blocks unique local and link-local IPv6 (`::1`, `fe80::/10`, `fc00::/7`).
   - Enforces `http:` and `https:` protocol whitelist.
   - Validates every hop during HTTP redirects.
2. **Terminal Injection Protection**:
   - Strips ANSI escape codes (`\x1b[...]`) and control characters from untrusted search snippets before rendering.
3. **AI Prompt Injection Isolation**:
   - Untrusted web content returned to AI tools is fenced within explicit XML delimiters:
     `<untrusted_web_content source="..."> ... </untrusted_web_content>`
   - Neutralizes closing tag escapes to prevent jailbreak attacks.

---

## 📊 Supported Search Providers

All included providers operate without requiring paid API keys:

| Provider | Category | Type | Default Enabled |
|---|---|---|:---:|
| **DuckDuckGo** | General | Web search engine | Yes |
| **Wikipedia** | General / Encyclopedic | Factual knowledge & articles | Yes |
| **Hacker News** | Tech | Developer discussions & engineering | Yes |
| **GitHub** | Code | Open-source repositories & tools | Yes |
| **arXiv** | Science | Academic papers & preprints | Yes |
| **SearXNG** | General | Distributed meta-search aggregator | Yes |
| **Crossref** | Science | Scholarly publications & DOI lookup | Yes |

---

## 📜 Quotas, Dependencies & Transparency

- **Wander Search Engine**: 100% free, MIT licensed. No search limits imposed by Wander.
- **Local Mode**: Uses local system resources, zero external cloud dependencies.
- **Cloudflare Free Tier**: 100,000 requests per day across `workers.dev` endpoints.
- **GitHub Unauthenticated API**: 10 search requests per minute (can be increased to 30/min by providing an optional personal access token in `wander config`).

---

## 🧪 Testing

Run the automated test suite:

```bash
npm test
```

Includes unit and integration tests for security, SSRF filters, URL normalization, RRF ranking, HTML-to-markdown extraction, configuration rollbacks, and the MCP stdio protocol.

---

## 📄 License

MIT © [Wander Contributors](LICENSE)
