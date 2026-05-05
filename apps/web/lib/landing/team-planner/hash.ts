import { randomBytes } from "node:crypto";

// 10-char base62 hash for /plan/<hash> hotlinks.
//
// Length: 10 chars × log2(62) ≈ 59.5 bits of entropy → 8.4 × 10¹⁷ keyspace.
// Brute-forcing the table at any realistic rate-limited request rate would
// take longer than the age of the universe; concrete enumeration risk is
// covered by the 404-on-unknown-hash response and PR 5's IP rate limit.
//
// Constant-time enough for our use; the page is unlisted from SEO and the
// hash is the only auth, so we don't need cryptographic timing-attack
// hardness — just unguessability.

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const HASH_LENGTH = 10;

export function generatePlanHash(): string {
  const bytes = randomBytes(HASH_LENGTH);
  let out = "";
  for (let i = 0; i < HASH_LENGTH; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

export function isValidHashShape(input: unknown): input is string {
  return (
    typeof input === "string" &&
    input.length === HASH_LENGTH &&
    /^[0-9A-Za-z]+$/.test(input)
  );
}
