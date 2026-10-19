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

export interface MembershipEvent {
  txHash: ccc.Hex;
  blockNumber: bigint;
  kind: "joined" | "payment" | "top-up" | "ended";
  amount: bigint;
}

/**
 * The full history of one membership, newest first. Its type script never
 * changes over its life (Type ID + member lock hash), so an exact search finds
 * the join, every payment, every top-up and the end.
 */
export async function membershipHistory(
  client: ccc.Client,
  sub: { cell: ccc.Cell; subscriberLockHash: ccc.Hex; terms: { recipientLockHash: ccc.Hex } },
  limit = 50,
): Promise<MembershipEvent[]> {
  const type = sub.cell.cellOutput.type!;
  const found: { txHash: ccc.Hex; blockNumber: bigint }[] = [];
  for await (const t of client.findTransactions({ script: type, scriptType: "type", scriptSearchMode: "exact", groupByTransaction: true }, "desc", limit)) {
    found.push({ txHash: t.txHash, blockNumber: t.blockNumber });
  }
  const events = await Promise.all(
    found.map(async (f): Promise<MembershipEvent | undefined> => {
      const res = await client.getTransaction(f.txHash);
      if (!res) return undefined;
      const tx = res.transaction;
      const sumTo = (lockHash: ccc.Hex) => tx.outputs.filter((o) => o.lock.hash() === lockHash).reduce((a, o) => a + o.capacity, 0n);
      const out = tx.outputs.find((o) => o.type?.eq(type));
      let inCap: bigint | undefined;
      for (const input of tx.inputs) {
        const cell = await input.getCell(client);
        if (cell.cellOutput.type?.eq(type)) inCap = cell.cellOutput.capacity;
      }
      const base = { txHash: f.txHash, blockNumber: f.blockNumber };
      if (inCap === undefined) return { ...base, kind: "joined", amount: sumTo(sub.terms.recipientLockHash) };
      // Wallet change also lands on the member lock, so report the balance that was released
      if (!out) return { ...base, kind: "ended", amount: inCap };
      if (out.capacity > inCap) return { ...base, kind: "top-up", amount: out.capacity - inCap };
      return { ...base, kind: "payment", amount: sumTo(sub.terms.recipientLockHash) };
    }),
  );
  return events.filter((e): e is MembershipEvent => e !== undefined);
}
