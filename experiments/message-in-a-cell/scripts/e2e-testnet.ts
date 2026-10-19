/**
 * Message in a Cell: live testnet end-to-end check.
 *
 * Usage (same key-loading as the deploy; the key is never printed):
 *   export PRIVATE_KEY=$(grep -aoE 'PRIVATE_KEY=0x[0-9a-fA-F]{64}' ~/.zsh_history | tail -1 | cut -d= -f2)
 *   npx tsx scripts/e2e-testnet.ts
 *   unset PRIVATE_KEY
 *
 * Runs about 10–15 minutes and spends ~600 CKB in total, all returned to the
 * same wallet except network fees.
 *   1. Gift, sent as a link, opening in ~2 minutes: opening early must be
 *      refused by the network, then the gift key opens it on time and the
 *      message decrypts from chain history.
 *   2. Legacy with a 2-minute inactivity window: the owner checks in (cell moves),
 *      then after the window the beneficiary's link opens it.
 */
import { ccc } from "@ckb-ccc/core";
import {
  buildCheckInTx, buildOpenWithGiftKeyTx, buildSealTx, loadCapsule, openCapsuleData, packCapsule,
  randomBytes, capsuleId, MEDIAN_TIME_LAG_SECS,
} from "../lib/capsule";

const CKB = 100_000_000n;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function waitCommitted(client: ccc.Client, txHash: string) {
  for (let i = 0; i < 120; i++) {
    const r = await client.getTransaction(txHash);
    if (r?.status === "committed") return;
    await sleep(3000);
  }
  throw new Error(`tx ${txHash} not committed after 6 minutes`);
}

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("Load PRIVATE_KEY first (see the usage at the top of this file)");
  const client = new ccc.ClientPublicTestnet();
  const me = new ccc.SignerCkbPrivateKey(client, pk);
  const myLock = (await me.getRecommendedAddressObj()).script;
  log("wallet", await me.getRecommendedAddress(), "balance", ccc.fixedPointToString(await me.getBalance()), "CKB");

  // ── 1. Gift, sent as a link ──
  const key = randomBytes(32);
  const unlockAt = BigInt(Math.floor(Date.now() / 1000)) + 120n;
  const photo = randomBytes(1500);
  const data = await packCapsule(key, unlockAt, { from: "E2E", to: "Future", occasion: "test", letter: "Hello from the past.", photo });
  const seal = await buildSealTx({ sender: me, mode: "gift", t: unlockAt, data, giftCapacity: 100n * CKB });
  const sealHash = await me.sendTransaction(seal.tx);
  log("1. sealed gift link capsule", sealHash, `(${ccc.fixedPointToString(seal.capsuleCapacity)} CKB)`);
  await waitCommitted(client, sealHash);
  const id = capsuleId({ txHash: sealHash, index: 0 });

  let loaded = (await loadCapsule(client, id))!;
  try {
    const early = await buildOpenWithGiftKeyTx(client, loaded.cell, seal.giftKey!, myLock);
    await early.giftSigner.sendTransaction(early.tx);
    throw new Error("FAIL: opening early was accepted");
  } catch (e) {
    if (String(e).includes("FAIL")) throw e;
    log("1. early open refused ✓", String(e).match(/Immature|error code -?\d+|since/i)?.[0] ?? String(e).slice(0, 80));
  }

  log("1. waiting until the network's clock passes the opening time…");
  for (;;) {
    const tip = await client.getTipHeader();
    if (tip.timestamp / 1000n - MEDIAN_TIME_LAG_SECS >= unlockAt) break;
    await sleep(15_000);
  }
  for (let attempt = 0; ; attempt++) {
    try {
      loaded = (await loadCapsule(client, id))!;
      const open = await buildOpenWithGiftKeyTx(client, loaded.cell, seal.giftKey!, myLock);
      const openHash = await open.giftSigner.sendTransaction(open.tx);
      log("1. opened with the gift key", openHash);
      await waitCommitted(client, openHash);
      break;
    } catch (e) {
      if (attempt > 12 || !/Immature/i.test(String(e))) throw e;
      await sleep(20_000); // median time still catching up
    }
  }
  const after = (await loadCapsule(client, id))!;
  const opened = await openCapsuleData(key, after.rawData);
  if (after.view.state !== "opened" || opened.letter !== "Hello from the past." || opened.photo.length !== photo.length) throw new Error("FAIL: keepsake mismatch");
  log("1. state opened, letter and photo decrypt from chain history ✓");

  // ── 2. Legacy: check-in moves the cell, then the beneficiary opens after the window ──
  const key2 = randomBytes(32);
  const data2 = await packCapsule(key2, 0n, { from: "E2E", to: "Heir", occasion: "legacy test", letter: "If you're reading this…" });
  const seal2 = await buildSealTx({ sender: me, mode: "legacy", t: 120n, data: data2, giftCapacity: 50n * CKB });
  const seal2Hash = await me.sendTransaction(seal2.tx);
  log("2. sealed legacy capsule", seal2Hash);
  await waitCommitted(client, seal2Hash);
  const id2 = capsuleId({ txHash: seal2Hash, index: 0 });
  const l2 = (await loadCapsule(client, id2))!;
  const checkIn = await buildCheckInTx(l2.cell, me);
  const checkInHash = await me.sendTransaction(checkIn);
  log("2. owner checked in", checkInHash);
  await waitCommitted(client, checkInHash);
  const moved = (await loadCapsule(client, id2))!;
  if (moved.view.outPoint.txHash !== checkInHash) throw new Error("FAIL: old link didn't follow the check-in");
  log("2. old link follows the moved capsule ✓");

  log("2. waiting out the 2-minute inactivity window…");
  for (let attempt = 0; ; attempt++) {
    await sleep(30_000);
    try {
      const cur = (await loadCapsule(client, id2))!;
      const open = await buildOpenWithGiftKeyTx(client, cur.cell, seal2.giftKey!, myLock);
      const h = await open.giftSigner.sendTransaction(open.tx);
      log("2. beneficiary opened it", h);
      await waitCommitted(client, h);
      break;
    } catch (e) {
      if (attempt > 20 || !/Immature/i.test(String(e))) throw e;
    }
  }
  const legacyOpened = await openCapsuleData(key2, (await loadCapsule(client, id2))!.rawData);
  if (legacyOpened.letter !== "If you're reading this…") throw new Error("FAIL: legacy letter mismatch");
  log("2. legacy letter decrypts ✓");

  log("ALL PASSED. Balance now", ccc.fixedPointToString(await me.getBalance()), "CKB");
  process.exit(0);
}

main().catch((e) => { console.error("E2E FAILED:", e); process.exit(1); });
