import { BaseProvider } from "./base.js";
import { SearchResult, SearchOptions, ProviderCapability } from "../core/types.js";
import { safeFetch } from "../utils/http.js";
import { sanitizeForTerminal } from "../core/security.js";

export class GitHubProvider extends BaseProvider {
  readonly name = "github";
  readonly displayName = "GitHub (Code & Repos)";
  readonly category = "code" as const;
  readonly capabilities: ProviderCapability = {
    supportsFreshness: false,
    supportsCategories: true,
    requiresKey: false,
    rateLimitPerMin: 10,
    category: "code"
  };

  private token?: string;

  constructor(token?: string) {
    super();
    this.token = token;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = options.limit ?? 5;
    const timeoutMs = options.timeoutMs ?? 6000;
    const apiUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}&sort=stars`;

    const headers: Record<string, string> = {
      "User-Agent": "WanderSearch/1.0",
      "Accept": "application/vnd.github.v3+json"
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const res = await safeFetch(apiUrl, {
      timeoutMs,
      headers
    });

    if (!res.ok) {
      throw new Error(`GitHub returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const items = data?.items || [];
    const results: SearchResult[] = [];

    for (let i = 0; i < items.length; i++) {
      const repo = items[i];
      const name = repo.full_name;
      const desc = repo.description || "No description provided.";
      const stars = repo.stargazers_count ?? 0;
      const lang = repo.language || "Unknown";
      const snippet = `${desc} [${lang} ★ ${stars.toLocaleString()}]`;

      results.push({
        id: `gh-${repo.id || i + 1}`,
        title: sanitizeForTerminal(name),
        url: repo.html_url,
        snippet: sanitizeForTerminal(snippet),
        source: "GitHub",
        score: 0.88 - (i * 0.05),
        author: repo.owner?.login,
        publishedDate: repo.updated_at,
        metadata: {
          stars,
          forks: repo.forks_count,
          language: lang,
          license: repo.license?.spdx_id
        }
      });
    }

    return results;
  }
}
