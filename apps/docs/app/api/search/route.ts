import { source } from "@/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

// Cloudflare Pages runs Next on the Workers runtime — every server-side
// route in this app must be edge-compatible (no Node built-ins, no fs).
// Orama's search server uses an in-memory index built from `source`, so
// it runs cleanly on the edge.
export const runtime = "edge";

// Orama doesn't ship a Chinese tokenizer and its built-in English regex
// strips Han characters entirely, so `locale=zh` would either return empty
// results or throw. Tokenize CJK input character-by-character and keep
// Latin/digit runs whole — gives serviceable recall for Chinese docs while
// letting Romanized terms (product names, CLI commands) still match.
function tokenizeCJK(raw: string): string[] {
  const tokens: string[] = [];
  const regex = /[一-鿿㐀-䶿]|[A-Za-z0-9]+/g;
  const lower = raw.toLowerCase();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(lower)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

export const { GET } = createFromSource(source, {
  localeMap: {
    zh: {
      components: {
        tokenizer: {
          language: "english",
          normalizationCache: new Map(),
          tokenize: tokenizeCJK,
        },
      },
    },
  },
});
