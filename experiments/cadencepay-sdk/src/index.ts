/**
 * CadencePay SDK — v0.3.0 (for type script v3)
 *
 * Cell-native subscription payments on CKB. The subscriber funds one
 * Subscription Cell; anyone can claim at most `amount` per `interval`
 * for the creator; the subscriber can cancel at any time.
 *
 * Builders return unsigned ccc.Transactions. Signing is always done by the
 * party whose funds are spent: the subscriber (create, top-up, cancel) or
 * the keeper paying the claim/close fee. The SDK never needs a private key.
 */

import { ccc } from "@ckb-ccc/core";

// ── Deployments ──────────────────────────────────────────────

export interface ScriptDeployment {
  codeHash: ccc.Hex;
  hashType: ccc.HashType;
  cellDep: ccc.CellDepLike;
}

export interface CadencePayDeployment {
  cadencepay: ScriptDeployment;
  inputTypeProxyLock: ScriptDeployment;
}

export const TESTNET: CadencePayDeployment = {
  cadencepay: {
    codeHash: "0x7c271b62bc4b726f5997f3dbd221cfdbf31c944da19871dc1d8fc3bb75910419",
    hashType: "data1",
    cellDep: {
      outPoint: { txHash: "0x8acdf7ed16e21ed29c3fc0c9f2067e8901e7ee8dce5a1b4c686e5c24c9eada8b", index: 0 },
      depType: "code",
    },
  },
  inputTypeProxyLock: {
    codeHash: "0x5123908965c711b0ffd8aec642f1ede329649bda1ebdca6bd24124d3796f768a",
    hashType: "data1",
    cellDep: {
      outPoint: { txHash: "0xb4f171c9c9caf7401f54a8e56225ae21d95032150a87a4678eac3f66a3137b93", index: 1 },
      depType: "code",
    },
  },
};

// ── Constants (must match contracts/cadencepay/src/main.rs) ──

export const SUBSCRIPTION_DATA_SIZE = 56;
export const SUBSCRIPTION_ARGS_SIZE = 64;
export const MIN_INTERVAL_BLOCKS = 100n;
export const MAX_CANCEL_FEE = 1_000_000n; // shannons, 0.01 CKB
export const SHANNONS_PER_CKB = 100_000_000n;

export const ERROR_CODES: Record<number, string> = {
  1: "InvalidArgs", 2: "InvalidDataSize", 3: "InvalidGroupShape", 4: "TypeIdInvalid",
  5: "NoHeader", 6: "ClaimTooEarly", 7: "ScheduleNotAdvanced", 8: "FieldsChanged",
  9: "LockChanged", 10: "CapacityMismatch", 11: "PayoutMissing", 12: "MultipleSubscriptions",
  13: "SubscriberAuthMissing", 14: "RefundMissing", 15: "InvalidTerms", 16: "WrongLock",
  17: "InsufficientCapacity", 18: "Overflow", 19: "BalanceSufficient", 20: "InvalidStart",
  30: "Syscall",
};

// ── Terms (cell data) ────────────────────────────────────────

export interface SubscriptionTerms {
  /** blake2b hash of the creator's lock script */
  recipientLockHash: ccc.Hex;
  /** shannons paid per claim */
  amount: bigint;
  /** blocks between claims (≥ 100) */
  intervalBlocks: bigint;
  /** earliest block at which the next claim is valid */
  nextClaimBlock: bigint;
}

/** Encode terms into exactly 56 bytes (little-endian u64s). */
export function encodeTerms(terms: SubscriptionTerms): ccc.Bytes {
  const recipient = ccc.bytesFrom(terms.recipientLockHash);
  if (recipient.length !== 32) {
    throw new Error(`recipientLockHash must be 32 bytes, got ${recipient.length}`);
  }
  return ccc.bytesConcat(
    recipient,
    ccc.numLeToBytes(terms.amount, 8),
    ccc.numLeToBytes(terms.intervalBlocks, 8),
    ccc.numLeToBytes(terms.nextClaimBlock, 8),
  );
}

/** Decode cell data. Throws unless it is exactly 56 bytes, as the script requires. */
export function decodeTerms(data: ccc.BytesLike): SubscriptionTerms {
  const bytes = ccc.bytesFrom(data);
  if (bytes.length !== SUBSCRIPTION_DATA_SIZE) {
    throw new Error(`Expected ${SUBSCRIPTION_DATA_SIZE} bytes, got ${bytes.length}`);
  }
  return {
    recipientLockHash: ccc.hexFrom(bytes.slice(0, 32)),
    amount: ccc.numLeFromBytes(bytes.slice(32, 40)),
    intervalBlocks: ccc.numLeFromBytes(bytes.slice(40, 48)),
    nextClaimBlock: ccc.numLeFromBytes(bytes.slice(48, 56)),
  };
}

/** Same checks the script applies in create mode (except header and capacity). */
export function validateTerms(terms: SubscriptionTerms): void {
  if (terms.amount <= 0n) throw new Error("amount must be > 0");
  if (terms.intervalBlocks < MIN_INTERVAL_BLOCKS) {
    throw new Error(`intervalBlocks must be ≥ ${MIN_INTERVAL_BLOCKS}`);
  }
  if (/^0x0{64}$/.test(terms.recipientLockHash)) throw new Error("recipient must be set");
  if (terms.nextClaimBlock + terms.intervalBlocks > 0xffff_ffff_ffff_ffffn) {
    throw new Error("schedule overflows u64");
  }
}

// ── Scripts ──────────────────────────────────────────────────

/** Type ID = blake2b(first CellInput ‖ output index as u64 LE) */
export function typeIdFor(firstInput: ccc.CellInputLike, outputIndex: number): ccc.Hex {
  return ccc.hashCkb(ccc.CellInput.from(firstInput).toBytes(), ccc.numLeToBytes(outputIndex, 8));
}

export function subscriptionTypeScript(
  typeId: ccc.HexLike,
  subscriberLockHash: ccc.HexLike,
  deployment: CadencePayDeployment = TESTNET,
): ccc.Script {
  const args = ccc.bytesConcat(typeId, subscriberLockHash);
  if (args.length !== SUBSCRIPTION_ARGS_SIZE) throw new Error("type args must be 64 bytes");
  return ccc.Script.from({
    codeHash: deployment.cadencepay.codeHash,
    hashType: deployment.cadencepay.hashType,
    args: ccc.hexFrom(args),
  });
}

/** The Subscription Cell's lock: Input Type Proxy Lock over its own type hash. */
export function proxyLockFor(typeScript: ccc.ScriptLike, deployment: CadencePayDeployment = TESTNET): ccc.Script {
  return ccc.Script.from({
    codeHash: deployment.inputTypeProxyLock.codeHash,
    hashType: deployment.inputTypeProxyLock.hashType,
    args: ccc.Script.from(typeScript).hash(),
  });
}

export function subscriberLockHashOf(typeScript: ccc.ScriptLike): ccc.Hex {
  const args = ccc.bytesFrom(ccc.Script.from(typeScript).args);
  return ccc.hexFrom(args.slice(32, 64));
}

/** Occupied capacity of a v3 Subscription Cell in shannons (226 CKB). */
export function subscriptionOccupiedCapacity(): bigint {
  const dummyType = subscriptionTypeScript(new Uint8Array(32), new Uint8Array(32));
  const cell = ccc.CellOutput.from({ capacity: 0, lock: proxyLockFor(dummyType), type: dummyType });
  return BigInt(cell.occupiedSize + SUBSCRIPTION_DATA_SIZE) * SHANNONS_PER_CKB;
}

/** Smallest standalone payout cell for a recipient lock (8 bytes capacity + lock). */
export function minPayoutCapacity(recipientLock: ccc.ScriptLike): bigint {
  const out = ccc.CellOutput.from({ capacity: 0, lock: recipientLock });
  return BigInt(out.occupiedSize) * SHANNONS_PER_CKB;
}

function addDeps(tx: ccc.Transaction, deployment: CadencePayDeployment, withLock: boolean) {
  tx.addCellDeps(deployment.cadencepay.cellDep);
  if (withLock) tx.addCellDeps(deployment.inputTypeProxyLock.cellDep);
}

export interface TipHeader {
  hash: ccc.Hex;
  number: bigint;
}

// ── Validated live subscriptions ─────────────────────────────

export interface Subscription {
  cell: ccc.Cell;
  terms: SubscriptionTerms;
  typeId: ccc.Hex;
  subscriberLockHash: ccc.Hex;
}

/**
 * Parse a live cell as a v3 subscription. Returns undefined for anything the
 * script would never have accepted at creation (forged/legacy cells).
 */
export function parseSubscription(cell: ccc.Cell, deployment: CadencePayDeployment = TESTNET): Subscription | undefined {
  const type = cell.cellOutput.type;
  if (!type || type.codeHash !== deployment.cadencepay.codeHash || type.hashType !== deployment.cadencepay.hashType) {
    return undefined;
  }
  const args = ccc.bytesFrom(type.args);
  if (args.length !== SUBSCRIPTION_ARGS_SIZE) return undefined;
  if (!cell.cellOutput.lock.eq(proxyLockFor(type, deployment))) return undefined;
  let terms: SubscriptionTerms;
  try {
    terms = decodeTerms(cell.outputData);
    validateTerms(terms);
  } catch {
    return undefined;
  }
  return {
    cell,
    terms,
    typeId: ccc.hexFrom(args.slice(0, 32)),
    subscriberLockHash: ccc.hexFrom(args.slice(32, 64)),
  };
}

export type SubscriptionStatus = "active" | "due" | "low_balance" | "closable";

export interface SubscriptionView extends Subscription {
  status: SubscriptionStatus;
  /** CKB above occupied capacity, in shannons */
  balance: bigint;
  /** whole periods still funded */
  periodsRemaining: bigint;
  blocksUntilNextClaim: bigint;
}

export function viewSubscription(sub: Subscription, tipNumber: bigint, lowBalancePeriods = 2n): SubscriptionView {
  const balance = sub.cell.cellOutput.capacity - subscriptionOccupiedCapacity();
  const periodsRemaining = balance > 0n ? balance / sub.terms.amount : 0n;
  const blocksUntilNextClaim = sub.terms.nextClaimBlock > tipNumber ? sub.terms.nextClaimBlock - tipNumber : 0n;
  let status: SubscriptionStatus;
  if (periodsRemaining === 0n) status = "closable";
  else if (blocksUntilNextClaim === 0n) status = "due";
  else if (periodsRemaining < lowBalancePeriods) status = "low_balance";
  else status = "active";
  return { ...sub, status, balance, periodsRemaining, blocksUntilNextClaim };
}

/** All valid v3 subscriptions; filter by subscriber and/or recipient lock hash. */
export async function findSubscriptions(
  client: ccc.Client,
  filter: { subscriberLockHash?: ccc.HexLike; recipientLockHash?: ccc.HexLike } = {},
  deployment: CadencePayDeployment = TESTNET,
): Promise<Subscription[]> {
  const subscriber = filter.subscriberLockHash ? ccc.hexFrom(filter.subscriberLockHash) : undefined;
  const recipient = filter.recipientLockHash ? ccc.hexFrom(filter.recipientLockHash) : undefined;
  const found: Subscription[] = [];
  for await (const cell of client.findCells(
    {
      script: { codeHash: deployment.cadencepay.codeHash, hashType: deployment.cadencepay.hashType, args: "0x" },
      scriptType: "type",
      scriptSearchMode: "prefix",
      withData: true,
    },
  )) {
    const sub = parseSubscription(cell, deployment);
    if (!sub) continue;
    if (subscriber && sub.subscriberLockHash !== subscriber) continue;
    if (recipient && sub.terms.recipientLockHash !== recipient) continue;
    found.push(sub);
  }
  return found;
}

// ── Transaction builders ─────────────────────────────────────

export interface SubscribeParams {
  /** Subscriber's signer — a JoyID signer in the browser, or SignerCkbScriptReadonly on a server */
  subscriber: ccc.Signer;
  recipientLock: ccc.ScriptLike;
  amount: bigint;
  intervalBlocks: bigint;
  /** Periods to pre-fund in the cell (excluding the first one paid upfront) */
  prefundPeriods: bigint;
  tip: TipHeader;
  /** Pay the first period to the creator inside this tx (default true, threat model #18) */
  payFirstPeriod?: boolean;
  feeRate?: ccc.NumLike;
  deployment?: CadencePayDeployment;
}

export async function buildSubscribeTx(p: SubscribeParams): Promise<ccc.Transaction> {
  const deployment = p.deployment ?? TESTNET;
  const payFirst = p.payFirstPeriod ?? true;
  const recipientLock = ccc.Script.from(p.recipientLock);
  if (p.prefundPeriods < 1n) throw new Error("prefundPeriods must be ≥ 1");
  if (p.amount < minPayoutCapacity(recipientLock)) {
    throw new Error(
      `amount ${p.amount} is below the smallest payout cell (${minPayoutCapacity(recipientLock)} shannons); ` +
        "keepers could not claim it",
    );
  }
  const terms: SubscriptionTerms = {
    recipientLockHash: recipientLock.hash(),
    amount: p.amount,
    intervalBlocks: p.intervalBlocks,
    nextClaimBlock: payFirst ? p.tip.number + p.intervalBlocks : p.tip.number,
  };
  validateTerms(terms);

  const { script: subscriberLock } = await p.subscriber.getRecommendedAddressObj();
  const subscriberLockHash = subscriberLock.hash();
  const capacity = subscriptionOccupiedCapacity() + p.amount * p.prefundPeriods;

  // Type ID depends on the first input, so build with placeholder args first.
  const placeholderType = subscriptionTypeScript(new Uint8Array(32), subscriberLockHash, deployment);
  const tx = ccc.Transaction.from({
    outputs: [{ capacity, lock: proxyLockFor(placeholderType, deployment), type: placeholderType }],
    outputsData: [encodeTerms(terms)],
    headerDeps: [p.tip.hash],
  });
  if (payFirst) tx.addOutput({ capacity: p.amount, lock: recipientLock }, "0x");
  addDeps(tx, deployment, false);

  await tx.completeInputsByCapacity(p.subscriber);
  const typeScript = subscriptionTypeScript(typeIdFor(tx.inputs[0], 0), subscriberLockHash, deployment);
  tx.outputs[0].type = typeScript;
  tx.outputs[0].lock = proxyLockFor(typeScript, deployment);
  // Change goes to a new output after ours, so the subscription stays at index 0
  await tx.completeFeeBy(p.subscriber, p.feeRate);
  return tx;
}

export interface ClaimParams {
  /** Add fee inputs/change via the payer's signer (default true). false = shape only. */
  complete?: boolean;
  subscription: Subscription;
  recipientLock: ccc.ScriptLike;
  tip: TipHeader;
  /** Pays the fee from their own cells; must not be the recipient (fees would reduce the creator's net payout) */
  keeper: ccc.Signer;
  feeRate?: ccc.NumLike;
  deployment?: CadencePayDeployment;
}

export async function buildClaimTx(p: ClaimParams): Promise<ccc.Transaction> {
  const deployment = p.deployment ?? TESTNET;
  const { cell, terms } = p.subscription;
  const recipientLock = ccc.Script.from(p.recipientLock);
  if (recipientLock.hash() !== terms.recipientLockHash) throw new Error("recipientLock does not match the subscription");
  if (p.tip.number < terms.nextClaimBlock) {
    throw new Error(`not due: ${terms.nextClaimBlock - p.tip.number} blocks remaining`);
  }
  const { script: keeperLock } = await p.keeper.getRecommendedAddressObj();
  if (keeperLock.hash() === terms.recipientLockHash) {
    throw new Error("keeper must not be the recipient: the fee would be taken from the payout");
  }
  if (cell.cellOutput.capacity - terms.amount < subscriptionOccupiedCapacity()) {
    throw new Error("balance below one period: use buildCloseTx");
  }

  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: cell.outPoint }],
    outputs: [
      { capacity: cell.cellOutput.capacity - terms.amount, lock: cell.cellOutput.lock, type: cell.cellOutput.type },
      { capacity: terms.amount, lock: recipientLock },
    ],
    outputsData: [encodeTerms({ ...terms, nextClaimBlock: terms.nextClaimBlock + terms.intervalBlocks }), "0x"],
    headerDeps: [p.tip.hash],
  });
  addDeps(tx, deployment, true);
  if (p.complete ?? true) await tx.completeFeeBy(p.keeper, p.feeRate);
  return tx;
}

export interface TopUpParams {
  /** Add fee inputs/change via the payer's signer (default true). false = shape only. */
  complete?: boolean;
  subscription: Subscription;
  subscriber: ccc.Signer;
  addCapacity: bigint;
  feeRate?: ccc.NumLike;
  deployment?: CadencePayDeployment;
}

export async function buildTopUpTx(p: TopUpParams): Promise<ccc.Transaction> {
  const deployment = p.deployment ?? TESTNET;
  const { cell } = p.subscription;
  if (p.addCapacity <= 0n) throw new Error("addCapacity must be > 0");
  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: cell.outPoint }],
    outputs: [{ capacity: cell.cellOutput.capacity + p.addCapacity, lock: cell.cellOutput.lock, type: cell.cellOutput.type }],
    outputsData: [cell.outputData],
  });
  addDeps(tx, deployment, true);
  if (p.complete ?? true) {
    await tx.completeInputsByCapacity(p.subscriber);
    await tx.completeFeeBy(p.subscriber, p.feeRate);
  }
  return tx;
}

export interface CancelParams {
  /** Add fee inputs/change via the payer's signer (default true). false = shape only. */
  complete?: boolean;
  subscription: Subscription;
  subscriber: ccc.Signer;
  feeRate?: ccc.NumLike;
  deployment?: CadencePayDeployment;
}

/** Subscriber ends the subscription; everything comes back to their lock. */
export async function buildCancelTx(p: CancelParams): Promise<ccc.Transaction> {
  const deployment = p.deployment ?? TESTNET;
  const { cell } = p.subscription;
  const { script: subscriberLock } = await p.subscriber.getRecommendedAddressObj();
  if (subscriberLock.hash() !== p.subscription.subscriberLockHash) {
    throw new Error("signer is not this subscription's subscriber");
  }
  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: cell.outPoint }],
    outputs: [{ capacity: cell.cellOutput.capacity, lock: subscriberLock }],
    outputsData: ["0x"],
  });
  addDeps(tx, deployment, true);
  // The script recognises the subscriber by an input carrying their lock
  if (p.complete ?? true) {
    await tx.completeInputsAtLeastOne(p.subscriber);
    await tx.completeFeeBy(p.subscriber, p.feeRate);
  }
  return tx;
}

export interface CloseParams {
  /** Add fee inputs/change via the payer's signer (default true). false = shape only. */
  complete?: boolean;
  subscription: Subscription;
  subscriberLock: ccc.ScriptLike;
  keeper: ccc.Signer;
  feeRate?: ccc.NumLike;
  deployment?: CadencePayDeployment;
}

/** Anyone ends a cell that can no longer fund a period; all CKB goes to the subscriber. */
export async function buildCloseTx(p: CloseParams): Promise<ccc.Transaction> {
  const deployment = p.deployment ?? TESTNET;
  const { cell, terms } = p.subscription;
  const subscriberLock = ccc.Script.from(p.subscriberLock);
  if (subscriberLock.hash() !== p.subscription.subscriberLockHash) throw new Error("subscriberLock mismatch");
  if (cell.cellOutput.capacity - subscriptionOccupiedCapacity() >= terms.amount) {
    throw new Error("balance still covers a period: not closable");
  }
  const { script: keeperLock } = await p.keeper.getRecommendedAddressObj();
  if (keeperLock.hash() === p.subscription.subscriberLockHash) {
    throw new Error("the subscriber should cancel instead of close");
  }
  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: cell.outPoint }],
    outputs: [{ capacity: cell.cellOutput.capacity, lock: subscriberLock }],
    outputsData: ["0x"],
  });
  addDeps(tx, deployment, true);
  if (p.complete ?? true) await tx.completeFeeBy(p.keeper, p.feeRate);
  return tx;
}

/** Human-readable reason for a CadencePay script failure message. */
export function explainScriptError(message: string): string | undefined {
  const m = /error code (-?\d+)/.exec(message);
  return m ? ERROR_CODES[Number(m[1])] : undefined;
}
