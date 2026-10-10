import { NextRequest, NextResponse } from "next/server";
import { claimOne, KeeperError } from "@/lib/keeper";

// Best-effort per-instance rate limit. The real protection is that the keeper
// only spends a fee when a claim is actually due and valid on-chain.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const { txHash, index, recipientAddress } = (body ?? {}) as Record<string, unknown>;
  if (
    typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash) ||
    typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > 0xffff ||
    typeof recipientAddress !== "string" || !/^ck[bt]1[0-9a-z]{20,200}$/.test(recipientAddress)
  ) {
    return NextResponse.json({ success: false, error: "Expected { txHash, index, recipientAddress }" }, { status: 400 });
  }

  try {
    const claimTx = await claimOne({ txHash, index }, recipientAddress);
    return NextResponse.json({ success: true, txHash: claimTx });
  } catch (e) {
    const status = e instanceof KeeperError ? e.status : 500;
    const error = e instanceof KeeperError ? e.message : "Claim failed";
    if (!(e instanceof KeeperError)) console.error("claim error", e);
    return NextResponse.json({ success: false, error }, { status });
  }
}
