import { explainScriptError } from "@/lib/cadencepay-sdk";

const FRIENDLY: Record<string, string> = {
  ClaimTooEarly: "This payment isn't due yet.",
  InsufficientCapacity: "The subscription balance is too low for this action.",
  SubscriberAuthMissing: "Only the subscriber's wallet can do this.",
  BalanceSufficient: "This subscription still has funds; only the subscriber can cancel it.",
};

/** Turn wallet / RPC / script errors into something a non-crypto user can act on. */
export function friendlyTxError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/insufficient|not enough|InsufficientCapacity/i.test(msg) && !/error code/.test(msg)) {
    return "Not enough testnet CKB in your wallet. Get some free at faucet.nervos.org, then try again.";
  }
  if (/reject|cancel|denied|closed/i.test(msg)) return "You cancelled the request in your wallet.";
  const code = explainScriptError(msg);
  if (code) return FRIENDLY[code] ?? `The network rejected this transaction (${code}).`;
  return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
}
