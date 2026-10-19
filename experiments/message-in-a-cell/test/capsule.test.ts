import { test } from "node:test";
import assert from "node:assert/strict";
import { ccc } from "@ckb-ccc/core";
import {
  decodeLockArgs, encodeLockArgs, openCapsuleData, packCapsule, readPublicData, randomBytes,
  secretsFromFragment, secretsToFragment, sinceAbsoluteTime, sinceRelativeTime, parseCapsuleId, capsuleId,
  capsuleLock, occupiedCapacity,
} from "../lib/capsule";

const h = (b: number) => ccc.hexFrom(new Uint8Array(32).fill(b));

test("lock args round-trip and are exactly 73 bytes", () => {
  const terms = { mode: "legacy" as const, senderLockHash: h(1), recipientLockHash: h(2), t: 15_552_000n };
  const args = encodeLockArgs(terms);
  assert.equal(ccc.bytesFrom(args).length, 73);
  assert.deepEqual(decodeLockArgs(args), terms);
  assert.equal(decodeLockArgs("0x00"), undefined);
});

test("since encodings match RFC 0017 flags", () => {
  assert.equal(sinceAbsoluteTime(1n), 0x4000_0000_0000_0001n);
  assert.equal(sinceRelativeTime(1n), 0xc000_0000_0000_0001n);
});

test("capsule data: public fields readable, letter and photo only with the key", async () => {
  const key = randomBytes(32);
  const photo = randomBytes(500);
  const data = await packCapsule(key, 1_893_456_000n, { from: "Mum", to: "Amani", occasion: "18th birthday", letter: "Happy birthday, love.", photo });
  const pub = readPublicData(data)!;
  assert.equal(pub.from, "Mum");
  assert.equal(pub.occasion, "18th birthday");
  assert.ok(!Buffer.from(data).includes(Buffer.from("Happy birthday")), "letter must be encrypted");
  const opened = await openCapsuleData(key, data);
  assert.equal(opened.letter, "Happy birthday, love.");
  assert.deepEqual(opened.photo, photo);
  await assert.rejects(openCapsuleData(randomBytes(32), data), "wrong key must fail");
});

test("link fragment carries both keys", () => {
  const s = { key: randomBytes(32), giftKey: randomBytes(32) };
  const back = secretsFromFragment("#" + secretsToFragment(s)) as { key: Uint8Array; giftKey?: Uint8Array };
  assert.deepEqual(back.key, s.key);
  assert.deepEqual(back.giftKey, s.giftKey);
  assert.equal(secretsFromFragment("#k=short"), undefined);
});

test("capsule ids and capacity", () => {
  const op = { txHash: h(9), index: 2 };
  assert.deepEqual(parseCapsuleId(capsuleId(op)), op);
  assert.equal(parseCapsuleId("nope"), undefined);
  const lock = capsuleLock({ mode: "gift", senderLockHash: h(1), recipientLockHash: h(2), t: 1n });
  // 8 capacity + 32 code hash + 1 hash type + 73 args = 114 bytes, + data
  assert.equal(occupiedCapacity(lock, new Uint8Array(1000)), 1114n * 100_000_000n);
});

test("secret word: same seed + phrase gives the same keys; a wrong word doesn't", async () => {
  const { deriveFromPhrase, generatePhrase } = await import("../lib/secretWord");
  const { seedToFragment } = await import("../lib/capsule");
  const seed = randomBytes(32);
  const phrase = generatePhrase();
  assert.equal(phrase.split(" ").length, 4);
  const a = await deriveFromPhrase(seed, phrase);
  const b = await deriveFromPhrase(seed, "  " + phrase.toUpperCase() + " ");
  assert.deepEqual(a, b, "case and spacing don't matter");
  const c = await deriveFromPhrase(seed, phrase + "x");
  assert.notDeepEqual(a.key, c.key);
  const back = secretsFromFragment("#" + seedToFragment(seed));
  assert.ok(back && "needsWord" in back && back.seed.length === 32);
});
