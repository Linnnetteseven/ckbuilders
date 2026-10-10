import { SHANNONS_PER_CKB } from "@/lib/cadencepay-sdk";

export const EXPLORER_TX = (hash: string) =>
  `https://pudge.explorer.nervos.org/transaction/${hash}`;

export const EXPLORER_ADDRESS = (address: string) =>
  `https://pudge.explorer.nervos.org/address/${address}`;

export function formatCkb(shannons: bigint, digits = 0): string {
  const negative = shannons < 0n;
  const abs = negative ? -shannons : shannons;
  const whole = (abs / SHANNONS_PER_CKB).toLocaleString("en-US");
  const frac = (abs % SHANNONS_PER_CKB).toString().padStart(8, "0").slice(0, digits);
  return `${negative ? "−" : ""}${whole}${digits > 0 ? `.${frac}` : ""}`;
}

/** Testnet blocks are ~8 s apart. */
export function blocksToHuman(blocks: bigint): string {
  const minutes = (Number(blocks) * 8) / 60;
  if (minutes < 90) return `~${Math.max(1, Math.round(minutes))} min`;
  const hours = minutes / 60;
  if (hours < 36) return `~${Math.round(hours)} h`;
  return `~${Math.round(hours / 24)} days`;
}

export const shortHash = (h: string, head = 10, tail = 6) => `${h.slice(0, head)}…${h.slice(-tail)}`;
