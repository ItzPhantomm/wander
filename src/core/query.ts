import { InstantAnswer } from "./types.js";

export interface ParsedQuery {
  rawQuery: string;
  cleanQuery: string;
  siteFilter?: string;
  categoryFilter?: "general" | "tech" | "science" | "code";
  excludeTerms: string[];
  exactPhrases: string[];
}

/**
 * Parses search operators like site:xyz, category:code, "exact phrase", -term
 */
export function parseQuerySyntax(rawQuery: string): ParsedQuery {
  let clean = rawQuery;
  let siteFilter: string | undefined;
  let categoryFilter: "general" | "tech" | "science" | "code" | undefined;
  const excludeTerms: string[] = [];
  const exactPhrases: string[] = [];

  // Extract "exact phrases"
  const phraseRegex = /"([^"]+)"/g;
  let match;
  while ((match = phraseRegex.exec(clean)) !== null) {
    if (match[1]?.trim()) {
      exactPhrases.push(match[1].trim());
    }
  }
  clean = clean.replace(phraseRegex, " ").trim();

  // Extract site:domain
  const siteRegex = /\bsite:([^\s]+)/i;
  const siteMatch = clean.match(siteRegex);
  if (siteMatch) {
    siteFilter = siteMatch[1].toLowerCase().replace(/^https?:\/\//, "");
    clean = clean.replace(siteRegex, " ").trim();
  }

  // Extract category:cat
  const catRegex = /\bcategory:(general|tech|science|code)\b/i;
  const catMatch = clean.match(catRegex);
  if (catMatch) {
    categoryFilter = catMatch[1].toLowerCase() as any;
    clean = clean.replace(catRegex, " ").trim();
  }

  // Extract -exclude terms
  const terms = clean.split(/\s+/);
  const remainingTerms: string[] = [];

  for (const t of terms) {
    if (t.startsWith("-") && t.length > 1) {
      excludeTerms.push(t.slice(1).toLowerCase());
    } else if (t.trim()) {
      remainingTerms.push(t.trim());
    }
  }

  return {
    rawQuery,
    cleanQuery: remainingTerms.join(" ").trim() || rawQuery,
    siteFilter,
    categoryFilter,
    excludeTerms,
    exactPhrases
  };
}

/**
 * Evaluates quick instant answers for calculations or unit conversions.
 */
export function detectInstantAnswer(query: string): InstantAnswer | null {
  const trimmed = query.trim();

  // 1. Math calculation (e.g. "12 * 8", "sqrt(144)", "25 + 75 / 5")
  if (/^[\d\s+\-*/().^%]+$/.test(trimmed) && /[+\-*/^%]/.test(trimmed)) {
    try {
      // Safe sanitized arithmetic evaluation without eval()
      const sanitized = trimmed.replace(/\^/g, "**");
      // Validate tokens only contain numbers and basic math operators
      if (!/^[0-9+\-*/().\s*]+$/.test(sanitized)) return null;

      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${sanitized})`)();
      if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
        return {
          type: "calculation",
          title: "Calculation",
          answer: `${result.toLocaleString()}`,
          details: `${trimmed} = ${result}`
        };
      }
    } catch {}
  }

  // 2. Unit Conversions (e.g. "10 km to miles", "100 c to f", "50 kg to lbs")
  const convMatch = trimmed.match(/^([\d.]+)\s*([a-zA-Z]+)\s+(?:to|in)\s+([a-zA-Z]+)$/i);
  if (convMatch) {
    const val = parseFloat(convMatch[1]);
    const from = convMatch[2].toLowerCase();
    const to = convMatch[3].toLowerCase();

    if (!isNaN(val)) {
      if ((from === "km" || from === "kilometers") && (to === "miles" || to === "mi")) {
        const res = (val * 0.621371).toFixed(2);
        return { type: "conversion", title: "Unit Conversion", answer: `${res} miles`, details: `${val} km = ${res} mi` };
      }
      if ((from === "miles" || from === "mi") && (to === "km" || to === "kilometers")) {
        const res = (val * 1.60934).toFixed(2);
        return { type: "conversion", title: "Unit Conversion", answer: `${res} km`, details: `${val} miles = ${res} km` };
      }
      if ((from === "c" || from === "celsius") && (to === "f" || to === "fahrenheit")) {
        const res = (val * 9/5 + 32).toFixed(1);
        return { type: "conversion", title: "Temperature", answer: `${res} °F`, details: `${val}°C = ${res}°F` };
      }
      if ((from === "f" || from === "fahrenheit") && (to === "c" || to === "celsius")) {
        const res = ((val - 32) * 5/9).toFixed(1);
        return { type: "conversion", title: "Temperature", answer: `${res} °C`, details: `${val}°F = ${res}°C` };
      }
      if ((from === "kg" || from === "kilograms") && (to === "lbs" || to === "pounds")) {
        const res = (val * 2.20462).toFixed(2);
        return { type: "conversion", title: "Weight", answer: `${res} lbs`, details: `${val} kg = ${res} lbs` };
      }
      if ((from === "lbs" || from === "pounds") && (to === "kg" || to === "kilograms")) {
        const res = (val * 0.453592).toFixed(2);
        return { type: "conversion", title: "Weight", answer: `${res} kg`, details: `${val} lbs = ${res} kg` };
      }
    }
  }

  return null;
}
