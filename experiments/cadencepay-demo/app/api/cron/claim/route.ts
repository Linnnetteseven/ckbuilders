import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cadencepay-demo.vercel.app";

    const subsRes  = await fetch(`${baseUrl}/api/subscriptions`);
    const subsData = await subsRes.json() as {
      subscriptions: Array<{
        outPoint:    { txHash: string; index: string };
        cellDataHex: string;
        canClaimNow: boolean;
      }>;
    };

    const claimable = subsData.subscriptions.filter(s => s.canClaimNow);

    if (claimable.length === 0) {
      return NextResponse.json({ message: "No claims due", checked: subsData.subscriptions.length });
    }

    const results = await Promise.allSettled(
      claimable.map(sub =>
        fetch(`${baseUrl}/api/claim`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outPoint:    sub.outPoint,
            cellDataHex: sub.cellDataHex,
          }),
        }).then(r => r.json())
      )
    );

    const succeeded = results.filter(r => r.status === "fulfilled").length;
    const failed    = results.filter(r => r.status === "rejected").length;

    return NextResponse.json({
      checked: subsData.subscriptions.length,
      due:     claimable.length,
      succeeded,
      failed,
    });

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
