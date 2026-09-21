const hex = (s: string): `0x${string}` => s as `0x${string}`;
/**
 * CadencePay SDK — v0.2.0
 *
 * Cell-native subscription payment protocol on CKB.
 * Subscription agreements live on-chain as CKB cells.
 * Subscriber keeps custody of funds throughout. No vault.
 */

import { ccc } from "@ckb-ccc/core";

// ── Constants ────────────────────────────────────────────────

export const SUBSCRIPTION_DATA_SIZE = 56;
export const SUBSCRIPTION_CAPACITY  = 20000000000n; // 200 CKB in shannons

// ── Types ────────────────────────────────────────────────────

export interface SubscriptionParams {
  /** Recipient lock hash — who receives payment (0x-prefixed hex, 32 bytes) */
  recipientLockHash: string;
  /** Shannons per interval (1 CKB = 100_000_000 shannons) */
  amountPerInterval: bigint;
  /** Blocks between valid claims (~2000 blocks ≈ 1 day on CKB) */
  intervalBlocks: bigint;
  /** Subscriber lock hash — stored in type script args for cancel mode */
  subscriberLockHash: string;
}

export interface CadencePayConfig {
  client: ccc.Client;
  /** Code hash of deployed cadencepay binary */
  typeScriptCodeHash: string;
  typeScriptHashType: ccc.HashType;
}

// ── Encoding ─────────────────────────────────────────────────

/**
 * Encode subscription params into 56-byte on-chain cell data.
 *
 * Layout (all integers little-endian u64):
 *   [0..32]  recipient_lock_hash
 *   [32..40] amount_per_interval
 *   [40..48] interval_blocks
 *   [48..56] last_claimed_block  (0 on creation)
 */
export function encodeSubscriptionData(params: SubscriptionParams): Uint8Array {
  const data = new Uint8Array(SUBSCRIPTION_DATA_SIZE);
  const view = new DataView(data.buffer);

  const recipientBytes = hexToBytes(params.recipientLockHash);
  if (recipientBytes.length !== 32) {
    throw new Error(`recipientLockHash must be 32 bytes, got ${recipientBytes.length}`);
  }
  data.set(recipientBytes, 0);

  view.setBigUint64(32, params.amountPerInterval, true);
  view.setBigUint64(40, params.intervalBlocks, true);
  view.setBigUint64(48, 0n, true); // last_claimed_block = 0 on creation

  return data;
}

/**
 * Decode raw cell bytes into readable subscription fields.
 */
export function decodeSubscriptionData(data: Uint8Array): {
  recipientLockHash: string;
  amountPerInterval: bigint;
  intervalBlocks:    bigint;
  lastClaimedBlock:  bigint;
} {
  if (data.length < SUBSCRIPTION_DATA_SIZE) {
    throw new Error(`Expected ${SUBSCRIPTION_DATA_SIZE} bytes, got ${data.length}`);
  }
  const view = new DataView(data.buffer, data.byteOffset);
  return {
    recipientLockHash: bytesToHex(data.slice(0, 32)),
    amountPerInterval: view.getBigUint64(32, true),
    intervalBlocks:    view.getBigUint64(40, true),
    lastClaimedBlock:  view.getBigUint64(48, true),
  };
}

/**
 * Build output cell data for a claim transaction.
 * Identical to input except last_claimed_block = currentBlock.
 * The type script verifies this exact update.
 */
export function encodeClaimOutputData(
  inputData: Uint8Array,
  currentBlock: bigint
): Uint8Array {
  const output = new Uint8Array(inputData);
  new DataView(output.buffer).setBigUint64(48, currentBlock, true);
  return output;
}

// ── Queries ──────────────────────────────────────────────────

/**
 * Returns true if enough blocks have elapsed to trigger a claim.
 * Call before building a claim transaction to avoid wasted fees.
 */
export function canClaim(
  lastClaimedBlock: bigint,
  intervalBlocks:   bigint,
  currentBlock:     bigint
): boolean {
  return currentBlock >= lastClaimedBlock + intervalBlocks;
}

/**
 * Blocks remaining until next valid claim. Returns 0n if claimable now.
 */
export function blocksUntilNextClaim(
  lastClaimedBlock: bigint,
  intervalBlocks:   bigint,
  currentBlock:     bigint
): bigint {
  const next = lastClaimedBlock + intervalBlocks;
  return currentBlock >= next ? 0n : next - currentBlock;
}

// ── SDK Class ────────────────────────────────────────────────

export class CadencePay {
  private client:             ccc.Client;
  private typeScriptCodeHash: string;
  private typeScriptHashType: ccc.HashType;

  constructor(config: CadencePayConfig) {
    this.client             = config.client;
    this.typeScriptCodeHash = config.typeScriptCodeHash;
    this.typeScriptHashType = config.typeScriptHashType;
  }

  private buildTypeScript(subscriberLockHash: string): ccc.Script {
    return new ccc.Script(
      this.typeScriptCodeHash as `0x${string}`,
      this.typeScriptHashType,
      subscriberLockHash as `0x${string}`,
    );
  }

  /**
   * createSubscription — builds a transaction that creates a Subscription Cell.
   *
   * The subscriber signs once. After confirmation, anyone can trigger claims
   * when the interval elapses. Subscriber can cancel at any time.
   *
   * Transaction shape:
   *   inputs[]:    subscriber's CKB cells (coin selection by CCC SDK)
   *   outputs[0]:  Subscription Cell (owned by subscriber, type = cadencepay)
   *   outputs[1]:  change (handled by CCC SDK)
   */
  async createSubscription(
    signer: ccc.Signer,
    params: Omit<SubscriptionParams, "subscriberLockHash">
  ): Promise<ccc.Transaction> {
    const address           = await signer.getRecommendedAddressObj();
    const subscriberLock    = address.script;
    const subscriberLockHash = subscriberLock.hash();

    const typeScript = this.buildTypeScript(subscriberLockHash);
    const cellData   = encodeSubscriptionData({ ...params, subscriberLockHash });

    const tx = ccc.Transaction.from({
      outputs: [{
        lock:     subscriberLock,
        type:     typeScript,
        capacity: SUBSCRIPTION_CAPACITY,
      }],
      outputsData: [ccc.bytesFrom(cellData)],
    });

    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer);

    return tx;
  }

  /**
   * getSubscriptions — fetch all Subscription Cells for a subscriber.
   * Queries the chain directly by type script hash. No database.
   */
  async getSubscriptions(subscriberLockHash: string): Promise<Array<{
    outPoint:        ccc.OutPointLike;
    subscription:    ReturnType<typeof decodeSubscriptionData>;
    canClaimNow:     boolean;
    blocksRemaining: bigint;
  }>> {
    const tipHex      = await this.client.getTip();
    const currentBlock = BigInt(tipHex);
    const typeScript  = this.buildTypeScript(subscriberLockHash);
    const results     = [];

    for await (const cell of this.client.findCells({
      script:           typeScript,
      scriptType:       "type",
      scriptSearchMode: "exact",
    })) {
      const data = new Uint8Array(ccc.bytesFrom(cell.outputData ?? "0x"));
      if (data.length < SUBSCRIPTION_DATA_SIZE) continue;

      const subscription = decodeSubscriptionData(data);
      results.push({
        outPoint:        cell.outPoint,
        subscription,
        canClaimNow:     canClaim(subscription.lastClaimedBlock, subscription.intervalBlocks, currentBlock),
        blocksRemaining: blocksUntilNextClaim(subscription.lastClaimedBlock, subscription.intervalBlocks, currentBlock),
      });
    }

    return results;
  }
}

// ── Utilities ─────────────────────────────────────────────────

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error(`Invalid hex length: ${clean.length}`);
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}
