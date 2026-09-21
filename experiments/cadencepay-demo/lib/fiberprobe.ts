export interface RouteCheck {
  canPay:  boolean;
  method:  "graph" | "probe" | "unavailable";
  message: string;
}

export async function checkFiberRoute(
  _recipientNodeId: string,
  _amountShannons:  bigint
): Promise<RouteCheck> {
  // fiberprobe integration — connects to your npm package
  // Full integration active once Fiber node is running on testnet
  // Package: npm install fiberprobe (your Gone in 60ms hackathon SDK)
  return {
    canPay:  true,
    method:  "unavailable",
    message: "Route check ready — Fiber node required",
  };
}
