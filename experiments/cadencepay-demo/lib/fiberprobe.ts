/**
 * CadencePay × fiberprobe
 *
 * Before triggering a claim, verify the Fiber route to the creator's
 * node is alive. Prevents wasted gas on a claim that won't settle.
 *
 * fiberprobe (npm: fiberprobe) — built during Gone in 60ms hackathon
 * Two-tier approach:
 *   canPay()   — fast BFS over public gossip graph
 *   probePay() — live HTLC probe for ground truth
 */

export interface RouteCheck {
  canPay: boolean;
  method: "graph" | "probe" | "unavailable";
  message: string;
}

export async function checkFiberRoute(
  recipientNodeId: string,
  amountShannons: bigint,
): Promise<RouteCheck> {
  try {
    // fiberprobe requires a running Fiber node RPC
    // On testnet demo this may not be available — we fail open
    const fiberprobe = (await import("fiberprobe")) as any;
    const FiberProbe = fiberprobe.FiberProbe ?? fiberprobe.default?.FiberProbe;

    const probe = new FiberProbe({
      rpc: process.env.NEXT_PUBLIC_FIBER_RPC ?? "http://localhost:8114",
    });

    // Tier 1: graph check (fast, no funds at risk)
    const graph = await probe.canPay(recipientNodeId, amountShannons);
    if (graph.reachable) {
      return {
        canPay: true,
        method: "graph",
        message: `Route via ${graph.hopCount} hop${graph.hopCount !== 1 ? "s" : ""}`,
      };
    }

    // Tier 2: live HTLC probe (fake preimage — no funds move)
    const live = await probe.probePay(recipientNodeId, amountShannons);
    return {
      canPay: live.success,
      method: "probe",
      message: live.success
        ? "Route confirmed via live probe"
        : `No route: ${live.failureReason ?? "unknown"}`,
    };
  } catch {
    // Fiber node not available — fail open so UI isn't blocked
    return {
      canPay: true,
      method: "unavailable",
      message: "Route check skipped (no Fiber node)",
    };
  }
}
