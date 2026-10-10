import { ccc } from "@ckb-ccc/core";
import { TESTNET } from "@/lib/cadencepay-sdk";

export interface PayoutEvent {
  txHash: ccc.Hex;
  blockNumber: bigint;
  kind: "first payment" | "claim";
  amount: bigint;
}

/**
 * Payments a creator received through CadencePay, newest first: the upfront
 * payment inside each subscribe tx, and every claim. Read from the indexer;
 * no database.
 */
export async function creatorPayouts(client: ccc.Client, creatorLock: ccc.Script, limit = 40): Promise<PayoutEvent[]> {
  const found: { txHash: ccc.Hex; blockNumber: bigint; consumedSubscription: boolean }[] = [];
  for await (const t of client.findTransactions(
    {
      script: { codeHash: TESTNET.cadencepay.codeHash, hashType: TESTNET.cadencepay.hashType, args: "0x" },
      scriptType: "type",
      scriptSearchMode: "prefix",
      groupByTransaction: true,
    },
    "desc",
    limit,
  )) {
    found.push({ txHash: t.txHash, blockNumber: t.blockNumber, consumedSubscription: t.cells.some((c) => c.isInput) });
  }

  const events = await Promise.all(
    found.map(async (f): Promise<PayoutEvent | undefined> => {
      const res = await client.getTransaction(f.txHash);
      if (!res) return undefined;
      const amount = res.transaction.outputs
        .filter((o) => o.lock.eq(creatorLock))
        .reduce((sum, o) => sum + o.capacity, 0n);
      if (amount === 0n) return undefined; // top-ups, cancels, other creators
      return { txHash: f.txHash, blockNumber: f.blockNumber, kind: f.consumedSubscription ? "claim" : "first payment", amount };
    }),
  );
  return events.filter((e): e is PayoutEvent => e !== undefined);
}
