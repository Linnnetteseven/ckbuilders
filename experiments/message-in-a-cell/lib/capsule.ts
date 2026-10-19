/**
 * Message in a Cell: capsule SDK.
 *
 * A capsule is one cell:
 *   lock = capsule-lock (data1), args = mode u8 ‖ sender_lock_hash ‖ recipient_lock_hash ‖ t u64 LE
 *   data = a Molecule `Capsule` table: names, occasion, unlock time, the
 *          AES-GCM encrypted message (letter + optional photo), references to
 *          encrypted video/voice files, and an optional tiny blurred preview.
 *
 * Every byte of data locks 1 CKB of capacity, and opening the capsule
 * releases all of it to whoever opens it, so the message storage is part of
 * the gift.
 *
 * "Send as a link": the recipient may have no wallet yet. Sealing then makes a
 * throwaway gift key, sets the recipient to that key's secp256k1 lock, and
 * adds a tiny "key cell" under it (the lock requires a cell from the
 * recipient's lock in the opening tx). The link carries the gift key and the
 * message key in its #fragment, which never reaches a server.
 */
import { ccc } from "@ckb-ccc/core";

// ── Deployment ───────────────────────────────────────────────

export const CAPSULE_LOCK = {
  codeHash: "0x23d62274206d1204929fee3cb2514ab9945c2e1ab8d1fad6fef27ddc1af567be" as ccc.Hex,
  hashType: "data1" as const,
  /** Testnet deploy 2026-10-19, block 22,794,626 */
  cellDep: {
    outPoint: { txHash: "0x8b4bd8a041ef7e337552e70f8cce73ed4beb0e648921b7f26bd0d474b39f8f4b" as ccc.Hex, index: 0 },
    depType: "code" as const,
  },
};

export const MODE = { gift: 0, legacy: 1 } as const;
export type Mode = keyof typeof MODE;
export const RECLAIM_GRACE_SECS = 90n * 24n * 60n * 60n;
/** Consensus compares `since` to the median of recent block times, which trails real time by a few minutes */
export const MEDIAN_TIME_LAG_SECS = 300n;
const CKB = 100_000_000n;
/** Smallest secp256k1 cell; used for the "send as a link" key cell */
export const KEY_CELL_CAPACITY = 61n * CKB;

// ── since (RFC 0017) ─────────────────────────────────────────

export const sinceAbsoluteTime = (secs: bigint) => (0b10n << 61n) | secs;
export const sinceRelativeTime = (secs: bigint) => (1n << 63n) | (0b10n << 61n) | secs;

// ── Lock args ────────────────────────────────────────────────

export interface CapsuleTerms {
  mode: Mode;
  senderLockHash: ccc.Hex;
  recipientLockHash: ccc.Hex;
  /** gift: unlock time (Unix seconds); legacy: inactivity window (seconds) */
  t: bigint;
}

export function encodeLockArgs(terms: CapsuleTerms): ccc.Hex {
  return ccc.hexFrom(ccc.bytesConcat(
    [MODE[terms.mode]],
    ccc.bytesFrom(terms.senderLockHash),
    ccc.bytesFrom(terms.recipientLockHash),
    ccc.numLeToBytes(terms.t, 8),
  ));
}

export function decodeLockArgs(args: ccc.HexLike): CapsuleTerms | undefined {
  const b = ccc.bytesFrom(args);
  if (b.length !== 73 || b[0] > 1) return undefined;
  return {
    mode: b[0] === 0 ? "gift" : "legacy",
    senderLockHash: ccc.hexFrom(b.slice(1, 33)),
    recipientLockHash: ccc.hexFrom(b.slice(33, 65)),
    t: ccc.numLeFromBytes(b.slice(65, 73)),
  };
}

export const capsuleLock = (terms: CapsuleTerms) =>
  ccc.Script.from({ codeHash: CAPSULE_LOCK.codeHash, hashType: CAPSULE_LOCK.hashType, args: encodeLockArgs(terms) });

// ── Cell data (Molecule) ─────────────────────────────────────

export const MEDIA_KIND = { video: 1, voice: 2, photo: 3 } as const;

const MediaRef = ccc.mol.table({
  kind: ccc.mol.Uint8,
  sha256: ccc.mol.Byte32,
  url: ccc.mol.String,
  bytes: ccc.mol.Uint32,
});
export const CapsuleData = ccc.mol.table({
  version: ccc.mol.Uint8,
  from: ccc.mol.String,
  to: ccc.mol.String,
  occasion: ccc.mol.String,
  unlockAt: ccc.mol.Uint64,
  nonce: ccc.mol.Bytes,
  ciphertext: ccc.mol.Bytes,
  media: ccc.mol.vector(MediaRef),
  thumb: ccc.mol.Bytes,
});
/** What's inside the ciphertext */
const SealedContent = ccc.mol.table({ letter: ccc.mol.String, photo: ccc.mol.Bytes });

export type CapsuleDataT = ReturnType<typeof CapsuleData.decode>;
export interface Media { kind: number; sha256: ccc.Hex; url: string; bytes: number }

// ── Encryption (AES-256-GCM, key never leaves the browser except in the link #fragment) ──

const subtle = () => globalThis.crypto.subtle;
export const randomBytes = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

async function aesKey(raw: Uint8Array) {
  return subtle().importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encrypt(key: Uint8Array, plain: Uint8Array) {
  const nonce = randomBytes(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, await aesKey(key), plain as BufferSource));
  return { nonce, ciphertext: ct };
}
export async function decrypt(key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array) {
  return new Uint8Array(await subtle().decrypt({ name: "AES-GCM", iv: nonce as BufferSource }, await aesKey(key), ciphertext as BufferSource));
}
export async function sha256(bytes: Uint8Array): Promise<ccc.Hex> {
  return ccc.hexFrom(new Uint8Array(await subtle().digest("SHA-256", bytes as BufferSource)));
}

export interface Letter { from: string; to: string; occasion: string; letter: string; photo?: Uint8Array; thumb?: Uint8Array; media?: Media[] }

/** Encrypt the letter (and photo) and pack everything into cell data. */
export async function packCapsule(key: Uint8Array, unlockAt: bigint, l: Letter): Promise<ccc.Bytes> {
  const plain = SealedContent.encode({ letter: l.letter, photo: l.photo ?? new Uint8Array() });
  const { nonce, ciphertext } = await encrypt(key, ccc.bytesFrom(plain));
  return ccc.bytesFrom(CapsuleData.encode({
    version: 1, from: l.from, to: l.to, occasion: l.occasion, unlockAt,
    nonce, ciphertext, media: l.media ?? [], thumb: l.thumb ?? new Uint8Array(),
  }));
}

export async function openCapsuleData(key: Uint8Array, data: ccc.BytesLike) {
  const d = CapsuleData.decode(data);
  const plain = SealedContent.decode(await decrypt(key, ccc.bytesFrom(d.nonce), ccc.bytesFrom(d.ciphertext)));
  return { ...d, letter: plain.letter, photo: ccc.bytesFrom(plain.photo) };
}

export function readPublicData(data: ccc.BytesLike): CapsuleDataT | undefined {
  try { return CapsuleData.decode(data); } catch { return undefined; }
}

// ── Share links ──────────────────────────────────────────────

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export interface LinkSecrets { key: Uint8Array; giftKey?: Uint8Array }
/** A link that needs its secret word: only the seed is in the link. */
export interface SeedOnly { seed: Uint8Array; needsWord: true }

export const secretsToFragment = (s: LinkSecrets) => `k=${b64u(s.key)}${s.giftKey ? `&g=${b64u(s.giftKey)}` : ""}`;
export const seedToFragment = (seed: Uint8Array) => `s=${b64u(seed)}&w=1`;

export function secretsFromFragment(fragment: string): LinkSecrets | SeedOnly | undefined {
  const p = new URLSearchParams(fragment.replace(/^#/, ""));
  try {
    if (p.get("s")) {
      const seed = unb64u(p.get("s")!);
      return seed.length === 32 ? { seed, needsWord: true } : undefined;
    }
    const key = p.get("k") ? unb64u(p.get("k")!) : undefined;
    if (!key || key.length !== 32) return undefined;
    const g = p.get("g") ? unb64u(p.get("g")!) : undefined;
    return { key, giftKey: g && g.length === 32 ? g : undefined };
  } catch { return undefined; }
}
/** The gift key's lock hash, to check a secret word before trying to open anything. */
export async function giftLockHash(client: ccc.Client, giftKey: Uint8Array): Promise<ccc.Hex> {
  return (await new ccc.SignerCkbPrivateKey(client, giftKey).getRecommendedAddressObj()).script.hash();
}
export const capsuleId = (op: { txHash: ccc.HexLike; index: ccc.NumLike }) => `${ccc.hexFrom(op.txHash)}-${Number(op.index)}`;
export function parseCapsuleId(id: string) {
  const m = /^(0x[0-9a-f]{64})-(\d{1,4})$/i.exec(id);
  return m ? { txHash: m[1].toLowerCase() as ccc.Hex, index: Number(m[2]) } : undefined;
}

// ── Transactions ─────────────────────────────────────────────

export function occupiedCapacity(lock: ccc.Script, data: ccc.BytesLike): bigint {
  return BigInt(ccc.CellOutput.from({ capacity: 0, lock }).occupiedSize + ccc.bytesFrom(data).length) * CKB;
}

export interface SealParams {
  sender: ccc.Signer;
  mode: Mode;
  /** recipient's lock, or undefined to "send as a link" (a gift key is made) */
  recipientLock?: ccc.Script;
  t: bigint;
  data: ccc.BytesLike;
  /** extra CKB on top of what storing the message needs */
  giftCapacity: bigint;
  /** link mode with a secret word: the gift key derived from link seed + phrase */
  giftKey?: Uint8Array;
}

/** Sender seals a capsule. Returns the unsigned tx plus the gift key for link mode. */
export async function buildSealTx(p: SealParams): Promise<{ tx: ccc.Transaction; giftKey?: Uint8Array; capsuleCapacity: bigint }> {
  const client = p.sender.client;
  const { script: senderLock } = await p.sender.getRecommendedAddressObj();
  let giftKey: Uint8Array | undefined;
  let recipientLock = p.recipientLock;
  if (!recipientLock) {
    giftKey = p.giftKey ?? randomBytes(32);
    recipientLock = (await new ccc.SignerCkbPrivateKey(client, giftKey).getRecommendedAddressObj()).script;
  }
  const lock = capsuleLock({ mode: p.mode, senderLockHash: senderLock.hash(), recipientLockHash: recipientLock.hash(), t: p.t });
  const capsuleCapacity = occupiedCapacity(lock, p.data) + p.giftCapacity;
  const tx = ccc.Transaction.from({
    outputs: [{ capacity: capsuleCapacity, lock }, ...(giftKey ? [{ capacity: KEY_CELL_CAPACITY, lock: recipientLock }] : [])],
    outputsData: [p.data, ...(giftKey ? ["0x"] : [])],
  });
  await tx.completeInputsByCapacity(p.sender);
  await tx.completeFeeBy(p.sender);
  return { tx, giftKey, capsuleCapacity };
}

function sinceFor(terms: CapsuleTerms, path: "recipient" | "sender"): bigint {
  if (terms.mode === "gift") return sinceAbsoluteTime(path === "recipient" ? terms.t : terms.t + RECLAIM_GRACE_SECS);
  return path === "recipient" ? sinceRelativeTime(terms.t) : 0n;
}

/**
 * Open (recipient), reclaim (gift sender after grace) or withdraw (legacy
 * owner). `wallet` is the authorised wallet; it adds one of its own cells
 * and receives everything as change.
 */
export async function buildSpendTx(capsule: ccc.Cell, wallet: ccc.Signer, path: "recipient" | "sender"): Promise<ccc.Transaction> {
  const terms = decodeLockArgs(capsule.cellOutput.lock.args);
  if (!terms) throw new Error("Not a capsule");
  const tx = ccc.Transaction.from({ inputs: [{ previousOutput: capsule.outPoint, since: sinceFor(terms, path) }] });
  tx.addCellDeps(CAPSULE_LOCK.cellDep);
  await tx.completeInputsAtLeastOne(wallet);
  await tx.completeFeeBy(wallet);
  return tx;
}

/**
 * Open a link capsule: the gift key unlocks it, and everything goes to
 * `toLock` (the recipient's new wallet). The fee comes out of the capsule, so
 * the recipient needs no CKB of their own.
 */
export async function buildOpenWithGiftKeyTx(client: ccc.Client, capsule: ccc.Cell, giftKey: Uint8Array, toLock: ccc.Script) {
  const terms = decodeLockArgs(capsule.cellOutput.lock.args);
  if (!terms) throw new Error("Not a capsule");
  const giftSigner = new ccc.SignerCkbPrivateKey(client, giftKey);
  const giftLock = (await giftSigner.getRecommendedAddressObj()).script;
  if (giftLock.hash() !== terms.recipientLockHash) throw new Error("This link's key doesn't match the capsule");
  let keyCell: ccc.Cell | undefined;
  for await (const c of client.findCellsByLock(giftLock, null, true)) { keyCell = c; break; }
  if (!keyCell) throw new Error("This capsule's key cell is missing");
  const tx = ccc.Transaction.from({
    inputs: [
      { previousOutput: capsule.outPoint, since: sinceFor(terms, "recipient") },
      { previousOutput: keyCell.outPoint },
    ],
    outputs: [{ capacity: capsule.cellOutput.capacity + keyCell.cellOutput.capacity, lock: toLock }],
    outputsData: ["0x"],
  });
  tx.addCellDeps(CAPSULE_LOCK.cellDep);
  await tx.completeFeeChangeToOutput(giftSigner, 0);
  return { tx, giftSigner };
}

/** Legacy "I'm still here": spend and re-create the same capsule, restarting the inactivity clock. */
export async function buildCheckInTx(capsule: ccc.Cell, owner: ccc.Signer): Promise<ccc.Transaction> {
  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: capsule.outPoint }],
    outputs: [capsule.cellOutput],
    outputsData: [capsule.outputData],
  });
  tx.addCellDeps(CAPSULE_LOCK.cellDep);
  await tx.completeInputsAtLeastOne(owner);
  await tx.completeFeeBy(owner);
  return tx;
}

// ── Reading the chain ────────────────────────────────────────

export type CapsuleState = "sealed" | "openable" | "reclaimable" | "opened";

export interface CapsuleView {
  id: string;
  outPoint: { txHash: ccc.Hex; index: number };
  terms: CapsuleTerms;
  capacity: bigint;
  data?: CapsuleDataT;
  state: CapsuleState;
  /** tx that opened / moved it, when spent */
  spentBy?: ccc.Hex;
}

/** Look a capsule up by id; works even after it was opened (the data stays in chain history). */
export async function loadCapsule(client: ccc.Client, id: string): Promise<{ view: CapsuleView; cell: ccc.Cell; rawData: ccc.Hex } | undefined> {
  const op = parseCapsuleId(id);
  if (!op) return undefined;
  const res = await client.getTransaction(op.txHash);
  const out = res?.transaction.outputs[op.index];
  if (!res || !out || out.lock.codeHash !== CAPSULE_LOCK.codeHash) return undefined;
  const terms = decodeLockArgs(out.lock.args);
  if (!terms) return undefined;
  const rawData = res.transaction.outputsData[op.index] ?? "0x";
  let cell = ccc.Cell.from({ outPoint: op, cellOutput: out, outputData: rawData });
  let live = await client.getCellLive(op, false);
  let createdIn = res;
  if (!live && terms.mode === "legacy") {
    // A check-in re-creates the same capsule elsewhere; follow it so old links keep working
    for await (const c of client.findCellsByLock(out.lock, null, true)) {
      if (c.outputData === rawData) {
        cell = c; live = c;
        createdIn = (await client.getTransaction(c.outPoint.txHash)) ?? res;
        break;
      }
    }
  }
  const nowSecs = (await client.getTipHeader()).timestamp / 1000n - MEDIAN_TIME_LAG_SECS;
  let state: CapsuleState = "opened";
  if (live) {
    if (terms.mode === "gift") {
      state = nowSecs >= terms.t + RECLAIM_GRACE_SECS ? "reclaimable" : nowSecs >= terms.t ? "openable" : "sealed";
    } else {
      // Relative to when this cell was created
      const created = createdIn.blockHash ? await client.getHeaderByHash(createdIn.blockHash) : undefined;
      const createdSecs = created ? created.timestamp / 1000n : nowSecs;
      state = nowSecs >= createdSecs + terms.t ? "openable" : "sealed";
    }
  }
  return {
    view: { id: capsuleId(cell.outPoint), outPoint: { txHash: cell.outPoint.txHash, index: Number(cell.outPoint.index) }, terms, capacity: cell.cellOutput.capacity, data: readPublicData(rawData), state },
    cell, rawData,
  };
}

/** Live capsules where `lockHash` is the sender or the recipient. */
export async function findMyCapsules(client: ccc.Client, lockHash: ccc.Hex, limit = 50) {
  const mine: { cell: ccc.Cell; terms: CapsuleTerms; role: "sender" | "recipient" }[] = [];
  for await (const cell of client.findCells({ script: { codeHash: CAPSULE_LOCK.codeHash, hashType: CAPSULE_LOCK.hashType, args: "0x" }, scriptType: "lock", scriptSearchMode: "prefix", withData: true })) {
    const terms = decodeLockArgs(cell.cellOutput.lock.args);
    if (!terms) continue;
    if (terms.senderLockHash === lockHash) mine.push({ cell, terms, role: "sender" });
    else if (terms.recipientLockHash === lockHash) mine.push({ cell, terms, role: "recipient" });
    if (mine.length >= limit) break;
  }
  return mine;
}

const ERRORS: Record<number, string> = {
  1: "InvalidArgs", 2: "NotAuthorized", 3: "TooEarly", 4: "ReclaimTooEarly", 5: "Overflow", 30: "Syscall",
};
export function explainCapsuleError(message: string): string | undefined {
  const m = /error code (-?\d+)/i.exec(message);
  return m ? ERRORS[Number(m[1])] : /Immature/i.test(message) ? "TooEarly" : undefined;
}
