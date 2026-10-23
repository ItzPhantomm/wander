import test from "node:test";
import assert from "node:assert/strict";
import { extractReadableContent } from "../src/core/extractor.js";

test("Extractor: strips scripts, ads, and converts HTML to clean markdown", () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Guide to Distributed Search</title>
        <meta name="author" content="Alice Dev">
      </head>
      <body>
        <nav><a href="/home">Home</a></nav>
        <script>alert("xss");</script>
        <div class="cookie-banner">Accept cookies</div>
        <article>
          <h1>Distributed Search Engines</h1>
          <p>Search engines index documents and answer queries efficiently.</p>
          <h2>Key Components</h2>
          <ul>
            <li>Inverted index</li>
            <li>Ranker</li>
          </ul>
          <pre><code class="language-rust">fn search() -> Vec<Result> { vec![] }</code></pre>
          <blockquote>"Simplicity is prerequisite for reliability."</blockquote>
        </article>
        <footer>Copyright 2026</footer>
      </body>
    </html>
  `;

  const extracted = extractReadableContent(html, "https://example.com/guide");

  assert.equal(extracted.title, "Guide to Distributed Search");
  assert.equal(extracted.byline, "Alice Dev");
  assert.equal(extracted.markdown.includes("alert(\"xss\")"), false);
  assert.equal(extracted.markdown.includes("Accept cookies"), false);
  assert.equal(extracted.markdown.includes("Copyright 2026"), false);
  assert.equal(extracted.markdown.includes("# Distributed Search Engines"), true);
  assert.equal(extracted.markdown.includes("## Key Components"), true);
  assert.equal(extracted.markdown.includes("- Inverted index"), true);
  assert.equal(extracted.markdown.includes("```rust"), true);
  assert.equal(extracted.markdown.includes("> \"Simplicity is prerequisite for reliability.\""), true);
});

test("Extractor: respects maxCharacters limit and indicates truncation", () => {
  const html = `<html><body><p>${"Repeated text content. ".repeat(100)}</p></body></html>`;
  const extracted = extractReadableContent(html, "https://example.com/long", { maxCharacters: 150 });

  assert.equal(extracted.isTruncated, true);
  assert.ok(extracted.markdown.includes("Content truncated due to size limit"));
});
