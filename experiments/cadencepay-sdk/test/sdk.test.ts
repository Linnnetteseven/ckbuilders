import { test } from "node:test";
import assert from "node:assert/strict";
import { ccc } from "@ckb-ccc/core";
import {
  TESTNET,
  SHANNONS_PER_CKB as CKB,
  encodeTerms,
  decodeTerms,
  validateTerms,
  typeIdFor,
  subscriptionTypeScript,
  proxyLockFor,
  subscriberLockHashOf,
  subscriptionOccupiedCapacity,
  minPayoutCapacity,
  parseSubscription,
  viewSubscription,
  buildClaimTx,
  buildCancelTx,
  buildCloseTx,
  buildTopUpTx,
  explainScriptError,
  type SubscriptionTerms,
} from "../src/index";

const client = new ccc.ClientPublicTestnet();
const secp = (args: string) =>
  ccc.Script.from({
    codeHash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
    hashType: "type",
    args,
  });
const subscriberLock = secp("0x" + "11".repeat(20));
const creatorLock = secp("0x" + "22".repeat(20));
const keeperLock = secp("0x" + "33".repeat(20));
const signer = (lock: ccc.Script) => new ccc.SignerCkbScriptReadonly(client, lock);

const AMOUNT = 100n * CKB;
const terms: SubscriptionTerms = {
  recipientLockHash: creatorLock.hash(),
  amount: AMOUNT,
  intervalBlocks: 2_000n,
  nextClaimBlock: 10_000n,
};

function liveCell(capacity: bigint, t: SubscriptionTerms = terms, opts: { lock?: ccc.Script; data?: ccc.HexLike; typeArgs?: ccc.Hex } = {}) {
  const type = opts.typeArgs
    ? ccc.Script.from({ codeHash: TESTNET.cadencepay.codeHash, hashType: "data1", args: opts.typeArgs })
    : subscriptionTypeScript("0x" + "ab".repeat(32), subscriberLock.hash());
  return ccc.Cell.from({
    outPoint: { txHash: "0x" + "cd".repeat(32), index: 0 },
    cellOutput: { capacity, lock: opts.lock ?? proxyLockFor(type), type },
    outputData: opts.data ?? ccc.hexFrom(encodeTerms(t)),
  });
}

// ── layout ──

test("terms encode to exactly 56 bytes and round-trip", () => {
  const bytes = encodeTerms(terms);
  assert.equal(bytes.length, 56);
  assert.deepEqual(decodeTerms(bytes), terms);
});

test("decodeTerms rejects 55 and 57 bytes (script requires exactly 56)", () => {
  const bytes = encodeTerms(terms);
  assert.throws(() => decodeTerms(bytes.slice(0, 55)));
  assert.throws(() => decodeTerms(ccc.bytesConcat(bytes, [0])));
});

test("validateTerms mirrors create-mode rules", () => {
  assert.throws(() => validateTerms({ ...terms, amount: 0n }));
  assert.throws(() => validateTerms({ ...terms, intervalBlocks: 99n }));
  assert.throws(() => validateTerms({ ...terms, recipientLockHash: ("0x" + "00".repeat(32)) as ccc.Hex }));
  assert.throws(() => validateTerms({ ...terms, nextClaimBlock: 0xffff_ffff_ffff_fff0n }));
  assert.doesNotThrow(() => validateTerms(terms));
});

test("typeIdFor hashes the 44-byte CellInput then the u64 LE output index", () => {
  const input = ccc.CellInput.from({ previousOutput: { txHash: "0x" + "01".repeat(32), index: 3 } });
  assert.equal(input.toBytes().length, 44);
  const expected = ccc.hashCkb(ccc.bytesConcat(input.toBytes(), ccc.numLeToBytes(0, 8)));
  assert.equal(typeIdFor(input, 0), expected);
  assert.notEqual(typeIdFor(input, 0), typeIdFor(input, 1));
});

test("type args = type_id ‖ subscriber lock hash; proxy lock args = own type hash", () => {
  const typeId = ("0x" + "ab".repeat(32)) as ccc.Hex;
  const type = subscriptionTypeScript(typeId, subscriberLock.hash());
  assert.equal(type.codeHash, TESTNET.cadencepay.codeHash);
  assert.equal(type.hashType, "data1");
  assert.equal(subscriberLockHashOf(type), subscriberLock.hash());
  const lock = proxyLockFor(type);
  assert.equal(lock.codeHash, "0x5123908965c711b0ffd8aec642f1ede329649bda1ebdca6bd24124d3796f768a");
  assert.equal(lock.args, type.hash());
});

test("occupied capacity is 226 CKB, matching the script tests", () => {
  assert.equal(subscriptionOccupiedCapacity(), 226n * CKB);
});

test("smallest secp256k1 payout cell is 61 CKB", () => {
  assert.equal(minPayoutCapacity(creatorLock), 61n * CKB);
});

// ── forged / legacy cells are ignored (threat model #8) ──

test("parseSubscription accepts a well-formed v3 cell", () => {
  const sub = parseSubscription(liveCell(600n * CKB));
  assert.ok(sub);
  assert.equal(sub.subscriberLockHash, subscriberLock.hash());
});

test("parseSubscription ignores a cell not locked by its own proxy lock", () => {
  assert.equal(parseSubscription(liveCell(600n * CKB, terms, { lock: keeperLock })), undefined);
});

test("parseSubscription ignores wrong data length and invalid terms", () => {
  assert.equal(parseSubscription(liveCell(600n * CKB, terms, { data: "0x00" })), undefined);
  assert.equal(parseSubscription(liveCell(600n * CKB, { ...terms, intervalBlocks: 0n })), undefined);
});

test("parseSubscription ignores v2-style 32-byte args", () => {
  assert.equal(parseSubscription(liveCell(600n * CKB, terms, { typeArgs: subscriberLock.hash() })), undefined);
});

// ── status ──

test("viewSubscription: active, due, low balance, closable", () => {
  const s = parseSubscription(liveCell(600n * CKB))!;
  assert.equal(viewSubscription(s, 9_000n).status, "active");
  assert.equal(viewSubscription(s, 10_000n).status, "due");
  assert.equal(viewSubscription(s, 9_000n).periodsRemaining, 3n); // (600 - 226) / 100
  const low = parseSubscription(liveCell(326n * CKB))!;
  assert.equal(viewSubscription(low, 9_000n).status, "low_balance");
  const empty = parseSubscription(liveCell(300n * CKB))!;
  assert.equal(viewSubscription(empty, 9_000n).status, "closable");
});

// ── builders (shape only, no network) ──

const tip = { hash: ("0x" + "ee".repeat(32)) as ccc.Hex, number: 10_005n };

test("claim tx: amount to creator, cell shrinks by amount, schedule += interval, both deps", async () => {
  const sub = parseSubscription(liveCell(600n * CKB))!;
  const tx = await buildClaimTx({ subscription: sub, recipientLock: creatorLock, tip, keeper: signer(keeperLock), complete: false });
  assert.equal(tx.inputs.length, 1);
  assert.equal(tx.outputs[0].capacity, 500n * CKB);
  assert.ok(tx.outputs[0].lock.eq(sub.cell.cellOutput.lock));
  assert.equal(decodeTerms(tx.outputsData[0]).nextClaimBlock, 12_000n);
  assert.ok(tx.outputs[1].lock.eq(creatorLock));
  assert.equal(tx.outputs[1].capacity, AMOUNT);
  assert.deepEqual(tx.headerDeps, [tip.hash]);
  assert.equal(tx.cellDeps.length, 2);
});

test("claim tx refuses: not due, keeper is the creator, balance below one period", async () => {
  const sub = parseSubscription(liveCell(600n * CKB))!;
  await assert.rejects(buildClaimTx({ subscription: sub, recipientLock: creatorLock, tip: { ...tip, number: 9_999n }, keeper: signer(keeperLock), complete: false }), /not due/);
  await assert.rejects(buildClaimTx({ subscription: sub, recipientLock: creatorLock, tip, keeper: signer(creatorLock), complete: false }), /keeper must not be the recipient/);
  const low = parseSubscription(liveCell(300n * CKB))!;
  await assert.rejects(buildClaimTx({ subscription: low, recipientLock: creatorLock, tip, keeper: signer(keeperLock), complete: false }), /buildCloseTx/);
});

test("claim tx refuses a recipient lock that does not match the terms", async () => {
  const sub = parseSubscription(liveCell(600n * CKB))!;
  await assert.rejects(buildClaimTx({ subscription: sub, recipientLock: keeperLock, tip, keeper: signer(keeperLock), complete: false }), /does not match/);
});

test("cancel tx refunds the full cell to the subscriber; only the subscriber may build it", async () => {
  const sub = parseSubscription(liveCell(600n * CKB))!;
  const tx = await buildCancelTx({ subscription: sub, subscriber: signer(subscriberLock), complete: false });
  assert.equal(tx.outputs.length, 1);
  assert.ok(tx.outputs[0].lock.eq(subscriberLock));
  assert.equal(tx.outputs[0].capacity, 600n * CKB);
  await assert.rejects(buildCancelTx({ subscription: sub, subscriber: signer(keeperLock), complete: false }), /not this subscription's subscriber/);
});

test("close tx only when balance < amount, refunds the subscriber", async () => {
  const funded = parseSubscription(liveCell(600n * CKB))!;
  await assert.rejects(buildCloseTx({ subscription: funded, subscriberLock, keeper: signer(keeperLock), complete: false }), /not closable/);
  const low = parseSubscription(liveCell(300n * CKB))!;
  const tx = await buildCloseTx({ subscription: low, subscriberLock, keeper: signer(keeperLock), complete: false });
  assert.ok(tx.outputs[0].lock.eq(subscriberLock));
  assert.equal(tx.outputs[0].capacity, 300n * CKB);
});

test("top-up keeps data identical and grows capacity", async () => {
  const sub = parseSubscription(liveCell(600n * CKB))!;
  const tx = await buildTopUpTx({ subscription: sub, subscriber: signer(subscriberLock), addCapacity: 200n * CKB, complete: false });
  assert.equal(tx.outputs[0].capacity, 800n * CKB);
  assert.equal(tx.outputsData[0], sub.cell.outputData);
});

test("explainScriptError maps script exit codes", () => {
  assert.equal(explainScriptError("ValidationFailure: see error code 11 on page"), "PayoutMissing");
  assert.equal(explainScriptError("something else"), undefined);
});
