import { NextRequest, NextResponse } from "next/server";
import { closeOne, KeeperError } from "@/lib/keeper";

// Close a membership that has run out of payments; the refund always goes to the member.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (recent.length > MAX_PER_WINDOW) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const { txHash, index } = (body ?? {}) as Record<string, unknown>;
  if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash) ||
      typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > 0xffff) {
    return NextResponse.json({ success: false, error: "Expected { txHash, index }" }, { status: 400 });
  }
  try {
    return NextResponse.json({ success: true, txHash: await closeOne({ txHash, index }) });
  } catch (e) {
    const status = e instanceof KeeperError ? e.status : 500;
    if (!(e instanceof KeeperError)) console.error("close error", e);
    return NextResponse.json({ success: false, error: e instanceof KeeperError ? e.message : "Close failed" }, { status });
  }
}
