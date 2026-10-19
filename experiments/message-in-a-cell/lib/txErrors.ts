import { explainCapsuleError } from "@/lib/capsule";

const FRIENDLY: Record<string, string> = {
  TooEarly: "It isn't time yet. The network checks the date, so please come back on the day (allow a few extra minutes).",
  ReclaimTooEarly: "You can only take an unopened gift back 90 days after its opening date.",
  NotAuthorized: "This wallet can't open this capsule. Use the wallet or link it was sent to.",
};

/** Turn wallet / RPC / script errors into something anyone can act on. */
export function friendlyTxError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const code = explainCapsuleError(msg);
  if (code) return FRIENDLY[code] ?? "The network didn't accept that. Nothing was taken. Please try again.";
  if (/insufficient|not enough/i.test(msg)) {
    return "Your wallet doesn't have enough test CKB. Get some free at faucet.nervos.org, then try again.";
  }
  if (/reject|cancel|denied|closed/i.test(msg)) return "You cancelled the request in your wallet.";
  return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
}
