import { WORDS } from "@/lib/wordlist";

/**
 * Secret word: a link plus a phrase, so a leaked link alone opens nothing.
 *
 * The link carries a random 32-byte seed. PBKDF2-SHA256(phrase, seed, 600k
 * rounds) stretches them into 64 bytes: the first half is the message key, the
 * second half is the gift key that opens the CKB. Someone with only the link
 * must guess the phrase, and every guess costs 600,000 hash rounds. Four
 * random words from 512 ≈ 36 bits, which is years of GPU time per capsule.
 */
export const PBKDF2_ROUNDS = 600_000;

export function generatePhrase(n = 4): string {
  const pick = new Uint32Array(n);
  crypto.getRandomValues(pick);
  return Array.from(pick, (x) => WORDS[x % WORDS.length]).join(" ");
}

/** Normalise so "Amber  Kettle" and "amber kettle" are the same phrase. */
export const normalisePhrase = (p: string) => p.trim().toLowerCase().replace(/\s+/g, " ");

export async function deriveFromPhrase(seed: Uint8Array, phrase: string): Promise<{ key: Uint8Array; giftKey: Uint8Array }> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(normalisePhrase(phrase)), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: seed as BufferSource, iterations: PBKDF2_ROUNDS }, material, 512));
  return { key: bits.slice(0, 32), giftKey: bits.slice(32, 64) };
}

export const phraseLooksStrong = (p: string) => normalisePhrase(p).split(" ").length >= 4 || normalisePhrase(p).length >= 16;
