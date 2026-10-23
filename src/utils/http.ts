import { validateUrlForSSRF } from "../core/security.js";

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  timeoutMs?: number;
  maxSizeBytes?: number;
  maxRedirects?: number;
  retries?: number;
  skipSSRF?: boolean; // Only for pre-verified internal routes if needed
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: Headers;
  text: () => Promise<string>;
  json: () => Promise<any>;
}

const DEFAULT_USER_AGENT = "Wander/1.0 (+https://github.com/wander-search/wander; open-source search engine)";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_MAX_REDIRECTS = 5;

/**
 * Resilient, SSRF-safe fetch with redirect validation and size limits.
 */
export async function safeFetch(targetUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const retries = options.retries ?? 1;

  let currentUrl = targetUrl;
  let redirectsFollowed = 0;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      while (true) {
        // Step 1: SSRF check on current URL
        if (!options.skipSSRF) {
          const ssrfCheck = await validateUrlForSSRF(currentUrl);
          if (!ssrfCheck.safe) {
            throw new Error(`SSRF validation blocked: ${ssrfCheck.reason}`);
          }
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);

        try {
          const reqHeaders = {
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            ...options.headers
          };

          const response = await fetch(currentUrl, {
            method: options.method || "GET",
            headers: reqHeaders,
            body: options.body,
            signal: controller.signal,
            redirect: "manual" // We handle redirects manually to check SSRF at each step!
          });

          // Step 2: Handle Redirects
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get("location");
            if (!location) {
              throw new Error(`Received HTTP ${response.status} redirect without a Location header.`);
            }

            if (redirectsFollowed >= maxRedirects) {
              throw new Error(`Too many redirects (exceeded limit of ${maxRedirects}).`);
            }

            const nextUrl = new URL(location, currentUrl).toString();
            currentUrl = nextUrl;
            redirectsFollowed++;
            continue;
          }

          // Step 3: Stream body with byte limit
          let bodyTextCache: string | null = null;

          const readLimitedBody = async (): Promise<string> => {
            if (bodyTextCache !== null) return bodyTextCache;

            const reader = response.body?.getReader();
            if (!reader) {
              bodyTextCache = await response.text();
              return bodyTextCache;
            }

            const chunks: Uint8Array[] = [];
            let totalBytes = 0;
            const decoder = new TextDecoder();
            let resultText = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                totalBytes += value.byteLength;
                if (totalBytes > maxSizeBytes) {
                  controller.abort();
                  throw new Error(`Response size exceeded maximum allowed limit of ${maxSizeBytes} bytes.`);
                }
                chunks.push(value);
                resultText += decoder.decode(value, { stream: true });
              }
            }
            resultText += decoder.decode();
            bodyTextCache = resultText;
            return bodyTextCache;
          };

          return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            url: currentUrl,
            headers: response.headers,
            text: readLimitedBody,
            json: async () => JSON.parse(await readLimitedBody())
          };
        } finally {
          clearTimeout(timer);
        }
      }
    } catch (err: any) {
      // If error is SSRF violation or bad url, do not retry
      if (err.message && (err.message.includes("SSRF") || err.message.includes("Disallowed protocol"))) {
        throw err;
      }
      if (attempt === retries) {
        throw err;
      }
      // Wait before retry
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
    }
  }

  throw new Error(`Failed to fetch ${targetUrl} after ${retries} retries.`);
}
