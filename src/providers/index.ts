import { BaseProvider } from "./base.js";
import { DuckDuckGoProvider } from "./duckduckgo.js";
import { WikipediaProvider } from "./wikipedia.js";
import { HackerNewsProvider } from "./hackernews.js";
import { GitHubProvider } from "./github.js";
import { ArXivProvider } from "./arxiv.js";
import { SearXNGProvider } from "./searxng.js";
import { CrossrefProvider } from "./crossref.js";
import { WanderConfig } from "../core/types.js";

export function createProviders(config?: Partial<WanderConfig>): Map<string, BaseProvider> {
  const map = new Map<string, BaseProvider>();

  const ddg = new DuckDuckGoProvider();
  map.set(ddg.name, ddg);

  const wiki = new WikipediaProvider();
  map.set(wiki.name, wiki);

  const hn = new HackerNewsProvider();
  map.set(hn.name, hn);

  const gh = new GitHubProvider(config?.keys?.github);
  map.set(gh.name, gh);

  const arxiv = new ArXivProvider();
  map.set(arxiv.name, arxiv);

  const searx = new SearXNGProvider(config?.search?.searxngInstance);
  map.set(searx.name, searx);

  const crossref = new CrossrefProvider();
  map.set(crossref.name, crossref);

  return map;
}

export {
  BaseProvider,
  DuckDuckGoProvider,
  WikipediaProvider,
  HackerNewsProvider,
  GitHubProvider,
  ArXivProvider,
  SearXNGProvider,
  CrossrefProvider
};
