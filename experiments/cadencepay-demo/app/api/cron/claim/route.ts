import { NextRequest, NextResponse } from "next/server";
import { claimAllDue } from "@/lib/keeper";
import { CREATORS } from "@/lib/creators";

// Vercel Cron (Hobby plan: once a day, see vercel.json). Vercel sends
// `Authorization: Bearer $CRON_SECRET`. A missing secret must never match.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = await claimAllDue(CREATORS.map((c) => c.payoutAddress));
    return NextResponse.json({
      claimed: results.filter((r) => r.txHash).length,
      failed: results.filter((r) => r.error).length,
      results,
    });
  } catch (e) {
    console.error("cron claim error", e);
    return NextResponse.json({ error: "Keeper run failed" }, { status: 500 });
  }
}
