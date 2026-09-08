/**
 * CadencePay SDK — v0.1.0
 *
 * Cell-native recurring payment protocol on CKB.
 * Type script enforces subscription intervals via header_deps.
 * Subscriber retains custody of funds throughout.
 *
 * Architecture:
 *   createSubscription() — locks a Subscription Cell on-chain
 *   claim()              — anyone can trigger when interval elapsed
 *   cancel()             — subscriber reclaims their cell (owner mode)
 */

export const SUBSCRIPTION_DATA_SIZE = 56;

export interface SubscriptionParams {
  /** Lock hash of the recipient (32 bytes hex) */
  recipientLockHash: string;
  /** Shannons to transfer per interval (1 CKB = 100_000_000 shannons) */
  amountPerInterval: bigint;
  /** Number of blocks between valid claims */
  intervalBlocks: bigint;
  /** Lock hash of the subscriber — can cancel at any time */
  subscriberLockHash: string;
}

/**
 * Encode subscription parameters into the 56-byte cell data format.
 *
 * Layout:
 *   [0..32]  recipient_lock_hash  (32 bytes)
 *   [32..40] amount_per_interval  (u64 LE)
 *   [40..48] interval_blocks      (u64 LE)
 *   [48..56] last_claimed_block   (u64 LE) — set to 0 on creation
 */
export function encodeSubscriptionData(params: SubscriptionParams): Uint8Array {
  const data = new Uint8Array(SUBSCRIPTION_DATA_SIZE);
  const view = new DataView(data.buffer);

  // recipient lock hash (32 bytes)
  const recipientBytes = hexToBytes(params.recipientLockHash);
  data.set(recipientBytes.slice(0, 32), 0);

  // amount per interval (u64 LE)
  view.setBigUint64(32, params.amountPerInterval, true);

  // interval blocks (u64 LE)
  view.setBigUint64(40, params.intervalBlocks, true);

  // last_claimed_block = 0 on creation
  view.setBigUint64(48, 0n, true);

  return data;
}

/**
 * Decode raw cell data back into subscription fields.
 */
export function decodeSubscriptionData(data: Uint8Array): {
  recipientLockHash: string;
  amountPerInterval: bigint;
  intervalBlocks: bigint;
  lastClaimedBlock: bigint;
} {
  if (data.length < SUBSCRIPTION_DATA_SIZE) {
    throw new Error(`Invalid data size: expected ${SUBSCRIPTION_DATA_SIZE}, got ${data.length}`);
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
 * Check if a claim is valid given current block number.
 * Use this before building a claim transaction to avoid wasted fees.
 */
export function canClaim(
  lastClaimedBlock: bigint,
  intervalBlocks: bigint,
  currentBlock: bigint
): boolean {
  return currentBlock >= lastClaimedBlock + intervalBlocks;
}

/**
 * Encode updated cell data for a claim transaction.
 * Identical to input data except last_claimed_block = currentBlock.
 */
export function encodeClaimOutputData(
  inputData: Uint8Array,
  currentBlock: bigint
): Uint8Array {
  const output = new Uint8Array(inputData);
  const view   = new DataView(output.buffer);
  view.setBigUint64(48, currentBlock, true);
  return output;
}

// ── Utilities ────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
