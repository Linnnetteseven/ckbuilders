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
  findSubscriptions,
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

/** Claim every due subscription paying one of `recipientAddresses`. One tx per subscription. */
export async function claimAllDue(recipientAddresses: string[]) {
  const client = new ccc.ClientPublicTestnet();
  const tip = await client.getTipHeader();
  const results: { outPoint: string; txHash?: string; error?: string }[] = [];
  for (const address of recipientAddresses) {
    const recipient = await ccc.Address.fromString(address, client);
    const subs = await findSubscriptions(client, { recipientLockHash: recipient.script.hash() });
    for (const sub of subs) {
      if (sub.terms.nextClaimBlock > tip.number) continue;
      const op = `${sub.cell.outPoint.txHash}:${sub.cell.outPoint.index}`;
      try {
        const txHash = await claimOne({ txHash: sub.cell.outPoint.txHash, index: Number(sub.cell.outPoint.index) }, address);
        results.push({ outPoint: op, txHash });
      } catch (e) {
        results.push({ outPoint: op, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return results;
}
