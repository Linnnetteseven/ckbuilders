import { explainScriptError } from "@/lib/cadencepay-sdk";

const FRIENDLY: Record<string, string> = {
  ClaimTooEarly: "That payment isn't ready yet.",
  InsufficientCapacity: "There isn't enough left in this membership for that.",
  SubscriberAuthMissing: "Only the wallet that started this membership can do that.",
  BalanceSufficient: "This membership still has payments saved, so only its member can cancel it.",
};

/** Turn wallet / RPC / script errors into something a non-crypto user can act on. */
export function friendlyTxError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/insufficient|not enough|InsufficientCapacity/i.test(msg) && !/error code/.test(msg)) {
    return "Your wallet doesn't have enough test CKB. Get some free at faucet.nervos.org, then try again.";
  }
  if (/reject|cancel|denied|closed/i.test(msg)) return "You cancelled the request in your wallet.";
  const code = explainScriptError(msg);
  if (code) return FRIENDLY[code] ?? "The network didn't accept that. Nothing was taken from your wallet. Please try again.";
  return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
}
