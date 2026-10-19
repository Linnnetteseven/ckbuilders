/**
 * Server-only keeper. Imported only by route handlers — never by a page or component.
 *
 * KEEPER_FEE_KEY pays transaction FEES for claims. It authorises nothing:
 * the CadencePay script lets anyone claim, and forces exactly `amount` to the
 * creator's lock. If this key leaked, the loss is its small fee balance.
 * Keep only a few hundred testnet CKB on it.
 */
import { ccc } from "@ckb-ccc/core";
import {
  buildClaimTx,
  buildCloseTx,
  findSubscriptions,
  type Subscription,
  parseSubscription,
  viewSubscription,
  explainScriptError,
} from "@/lib/cadencepay-sdk";

export class KeeperError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function keeperSigner(client: ccc.Client): ccc.SignerCkbPrivateKey {
  const key = process.env.KEEPER_FEE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new KeeperError("Keeper is not configured", 503);
  }
  return new ccc.SignerCkbPrivateKey(client, key as ccc.Hex);
}

/** Claim one due subscription. The cell is read from chain; nothing from the caller is trusted. */
export async function claimOne(outPoint: { txHash: string; index: number }, recipientAddress: string): Promise<string> {
  const client = new ccc.ClientPublicTestnet();
  const cell = await client.getCellLive({ txHash: outPoint.txHash as ccc.Hex, index: outPoint.index }, true);
  if (!cell) throw new KeeperError("Cell not found or already spent", 404);
  const sub = parseSubscription(cell);
  if (!sub) throw new KeeperError("Not a valid CadencePay v3 subscription", 400);

  let recipient: ccc.Address;
  try {
    recipient = await ccc.Address.fromString(recipientAddress, client);
  } catch {
    throw new KeeperError("Invalid recipient address", 400);
  }
  if (recipient.script.hash() !== sub.terms.recipientLockHash) {
    throw new KeeperError("Recipient address does not match this subscription", 400);
  }

  const tip = await client.getTipHeader();
  const view = viewSubscription(sub, tip.number);
  if (view.status === "closable") {
    throw new KeeperError("This membership has run out of payments; close it instead", 409);
  }
  if (view.status !== "due" && view.blocksUntilNextClaim > 0n) {
    throw new KeeperError(`Not due yet: ${view.blocksUntilNextClaim} blocks remaining`, 409);
  }

  const tx = await buildClaimTx({
    subscription: sub,
    recipientLock: recipient.script,
    tip: { hash: tip.hash, number: tip.number },
    keeper: keeperSigner(client),
  });
  try {
    return await keeperSigner(client).sendTransaction(tx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new KeeperError(explainScriptError(msg) ?? "Claim transaction rejected", 502);
  }
}

/**
 * The member's full lock script. Subscription args only hold its hash, so walk
 * back through the cell's history to a transaction the member signed (the join
 * or a top-up) and read the lock from their input there.
 */
async function findSubscriberLock(client: ccc.Client, sub: Subscription): Promise<ccc.Script> {
  const typeHash = sub.cell.cellOutput.type!.hash();
  let txHash: ccc.Hex = sub.cell.outPoint.txHash;
  for (let step = 0; step < 300; step++) {
    const res = await client.getTransaction(txHash);
    if (!res) break;
    let previous: ccc.Hex | undefined;
    for (const input of res.transaction.inputs) {
      const cell = await input.getCell(client);
      if (cell.cellOutput.lock.hash() === sub.subscriberLockHash) return cell.cellOutput.lock;
      if (cell.cellOutput.type?.hash() === typeHash) previous = input.previousOutput.txHash;
    }
    if (!previous) break;
    txHash = previous;
  }
  throw new KeeperError("Couldn't find the member's address for the refund", 500);
}

/**
 * Close a membership that can no longer fund a payment. Anyone may do this;
 * the script sends every remaining CKB back to the member.
 */
export async function closeOne(outPoint: { txHash: string; index: number }): Promise<string> {
  const client = new ccc.ClientPublicTestnet();
  const cell = await client.getCellLive({ txHash: outPoint.txHash as ccc.Hex, index: outPoint.index }, true);
  if (!cell) throw new KeeperError("Cell not found or already spent", 404);
  const sub = parseSubscription(cell);
  if (!sub) throw new KeeperError("Not a valid CadencePay v3 subscription", 400);
  const tip = await client.getTipHeader();
  if (viewSubscription(sub, tip.number).status !== "closable") {
    throw new KeeperError("This membership still has payments saved; only its member can end it", 409);
  }
  const subscriberLock = await findSubscriberLock(client, sub);
  const tx = await buildCloseTx({ subscription: sub, subscriberLock, keeper: keeperSigner(client) });
  try {
    return await keeperSigner(client).sendTransaction(tx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new KeeperError(explainScriptError(msg) ?? "Close transaction rejected", 502);
  }
}

/**
 * Keeper run: for every subscription paying one of `recipientAddresses`,
 * collect it if a payment is due, or close it (refunding the member) if it has
 * run out. One tx per subscription.
 */
export async function claimAllDue(recipientAddresses: string[]) {
  const client = new ccc.ClientPublicTestnet();
  const tip = await client.getTipHeader();
  const results: { outPoint: string; action: "collect" | "close"; txHash?: string; error?: string }[] = [];
  for (const address of recipientAddresses) {
    const recipient = await ccc.Address.fromString(address, client);
    const subs = await findSubscriptions(client, { recipientLockHash: recipient.script.hash() });
    for (const sub of subs) {
      const status = viewSubscription(sub, tip.number).status;
      if (status !== "due" && status !== "closable") continue;
      const op = { txHash: sub.cell.outPoint.txHash, index: Number(sub.cell.outPoint.index) };
      const action = status === "closable" ? "close" : "collect";
      try {
        const txHash = action === "close" ? await closeOne(op) : await claimOne(op, address);
        results.push({ outPoint: `${op.txHash}:${op.index}`, action, txHash });
      } catch (e) {
        results.push({ outPoint: `${op.txHash}:${op.index}`, action, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return results;
}
