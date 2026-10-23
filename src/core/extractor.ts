import * as cheerio from "cheerio";
import { FetchedContent } from "./types.js";
import { sanitizeForTerminal, wrapUntrustedContent } from "./security.js";

export interface ExtractionOptions {
  maxCharacters?: number;
  includeRawText?: boolean;
}

const DEFAULT_MAX_CHARS = 50000;

export function extractReadableContent(html: string, url: string, options: ExtractionOptions = {}): FetchedContent {
  const maxCharacters = options.maxCharacters ?? DEFAULT_MAX_CHARS;
  const $ = cheerio.load(html);

  // Extract metadata
  const title = $("title").first().text().trim() ||
                $('meta[property="og:title"]').attr("content")?.trim() ||
                $('meta[name="twitter:title"]').attr("content")?.trim() ||
                $("h1").first().text().trim() ||
                "Untitled Document";

  const siteName = $('meta[property="og:site_name"]').attr("content")?.trim() ||
                   $('meta[name="application-name"]').attr("content")?.trim() ||
                   new URL(url).hostname;

  const byline = $('meta[name="author"]').attr("content")?.trim() ||
                 $('meta[property="article:author"]').attr("content")?.trim() ||
                 $(".author, .byline, [rel='author']").first().text().trim();

  // Strip useless elements
  $("script, style, noscript, iframe, svg, canvas").remove();
  $("nav, header, footer, aside, .cookie-banner, .advertisement, .ad, .social-share").remove();
  $("[aria-hidden='true']").remove();

  // Pick main article container if available, else body
  let $content = $("article, main, [role='main'], .post-content, .article-body, .entry-content").first();
  if (!$content.length) {
    $content = $("body");
  }

  // Convert HTML nodes to markdown
  const markdownLines: string[] = [];

  function walk(node: any) {
    if (!node) return;

    if (node.type === "text") {
      const text = node.data?.trim();
      if (text) {
        markdownLines.push(text);
      }
      return;
    }

    if (node.type === "tag") {
      const tag = node.name.toLowerCase();
      const $el = $(node);

      switch (tag) {
        case "h1":
          markdownLines.push(`\n# ${$el.text().trim()}\n`);
          break;
        case "h2":
          markdownLines.push(`\n## ${$el.text().trim()}\n`);
          break;
        case "h3":
          markdownLines.push(`\n### ${$el.text().trim()}\n`);
          break;
        case "h4":
        case "h5":
        case "h6":
          markdownLines.push(`\n#### ${$el.text().trim()}\n`);
          break;
        case "p":
          const pText = $el.text().trim();
          if (pText) markdownLines.push(`\n${pText}\n`);
          break;
        case "pre": {
          const codeEl = $el.is("pre") && $el.find("code").length ? $el.find("code") : $el;
          const codeText = codeEl.text().trim();
          if (codeText) {
            const cls = codeEl.attr("class") || $el.attr("class") || "";
            const langMatch = cls.match(/language-(\w+)/);
            const lang = langMatch ? langMatch[1] : "";
            markdownLines.push(`\n\`\`\`${lang}\n${codeText}\n\`\`\`\n`);
          }
          break;
        }
        case "code":
          // Inline code if parent is not pre
          if ($el.parent("pre").length === 0) {
            const codeText = $el.text().trim();
            if (codeText) markdownLines.push(`\`${codeText}\``);
          }
          break;
        case "blockquote":
          const quoteText = $el.text().trim();
          if (quoteText) {
            markdownLines.push(`\n> ${quoteText.split("\n").join("\n> ")}\n`);
          }
          break;
        case "ul":
          $el.children("li").each((_, li) => {
            const liText = $(li).text().trim();
            if (liText) markdownLines.push(`- ${liText}`);
          });
          markdownLines.push("");
          break;
        case "ol":
          $el.children("li").each((i, li) => {
            const liText = $(li).text().trim();
            if (liText) markdownLines.push(`${i + 1}. ${liText}`);
          });
          markdownLines.push("");
          break;
        case "table":
          // Render markdown table
          const rows: string[][] = [];
          $el.find("tr").each((_, tr) => {
            const cells: string[] = [];
            $(tr).find("th, td").each((_, cell) => {
              cells.push($(cell).text().trim().replace(/\|/g, "\\|"));
            });
            if (cells.length > 0) rows.push(cells);
          });
          if (rows.length > 0) {
            markdownLines.push("\n");
            markdownLines.push(`| ${rows[0].join(" | ")} |`);
            markdownLines.push(`| ${rows[0].map(() => "---").join(" | ")} |`);
            for (let i = 1; i < rows.length; i++) {
              markdownLines.push(`| ${rows[i].join(" | ")} |`);
            }
            markdownLines.push("\n");
          }
          break;
        case "a":
          const href = $el.attr("href");
          const aText = $el.text().trim();
          if (href && aText && !href.startsWith("#") && !href.startsWith("javascript:")) {
            try {
              const fullHref = new URL(href, url).toString();
              markdownLines.push(`[${aText}](${fullHref})`);
            } catch {
              markdownLines.push(aText);
            }
          } else if (aText) {
            markdownLines.push(aText);
          }
          break;
        case "div":
        case "section":
        default:
          $el.contents().each((_, child) => walk(child));
          break;
      }
    }
  }

  walk($content[0]);

  let cleanMarkdown = markdownLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const isTruncated = cleanMarkdown.length > maxCharacters;
  if (isTruncated) {
    cleanMarkdown = cleanMarkdown.slice(0, maxCharacters) + "\n\n... [Content truncated due to size limit]";
  }

  const plainText = sanitizeForTerminal(cleanMarkdown.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[#*`_~]/g, ""));

  return {
    url,
    title: sanitizeForTerminal(title),
    siteName: siteName ? sanitizeForTerminal(siteName) : undefined,
    byline: byline ? sanitizeForTerminal(byline) : undefined,
    markdown: cleanMarkdown,
    plainText,
    length: cleanMarkdown.length,
    isTruncated,
    contentType: "text/markdown",
    fetchedAt: new Date().toISOString(),
    securityNotice: "Untrusted external web content. Delimited for isolation."
  };
}
