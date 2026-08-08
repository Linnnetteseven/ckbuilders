/**
 * lib.ts — CKB Time Capsule: on-chain logic
 *
 * Stores and retrieves time capsule data using CKB cells.
 * A capsule is JSON-encoded as UTF-8 bytes, then hex-encoded
 * into a cell's data field. CKB cells store arbitrary bytes —
 * using JSON makes the data human-readable and verifiable on
 * the block explorer without any special tools.
 *
 * Architecture note:
 * The open-date check here is a social contract enforced client-side.
 * A cryptographic time-lock — where the network itself rejects spends
 * before a given block timestamp — requires a custom lock script using
 * header_deps to read block time. That is the planned v2 upgrade once
 * we have Rust script development set up (Month 2).
 */

import { ccc } from "@ckb-ccc/core";

/** Shape of the data we store inside every time capsule cell */
export interface CapsuleData {
  to: string;        // who this message is addressed to
  from: string;      // who sealed it
  message: string;   // the message itself
  openDate: string;  // ISO date — "2027-08-06"
  sealedAt: string;  // ISO date — when it was written
}

/**
 * Serialises capsule data to a hex string for on-chain storage.
 * JSON → UTF-8 bytes → hex. The 0x prefix is required by CKB.
 */
export function encodeCapsule(data: CapsuleData): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Deserialises cell data hex back to a CapsuleData object.
 * Returns null if the hex does not contain valid capsule JSON.
 * We validate all required fields rather than blindly casting.
 */
export function decodeCapsule(hex: string): CapsuleData | null {
  try {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    const bytes = Uint8Array.from(
      clean.match(/.{1,2}/g)!.map((h) => parseInt(h, 16))
    );
    const json = new TextDecoder("utf-8").decode(bytes);
    const data = JSON.parse(json);

    // Validate all required fields are present and are strings.
    // Never trust data coming off-chain without checking it.
    const required: (keyof CapsuleData)[] = [
      "to", "from", "message", "openDate", "sealedAt"
    ];
    for (const field of required) {
      if (typeof data[field] !== "string" || data[field].trim() === "") {
        return null;
      }
    }

    return data as CapsuleData;
  } catch {
    // JSON.parse throws on malformed data. We treat all parse
    // failures the same way: this cell is not a time capsule.
    return null;
  }
}

/**
 * Returns true if today's date is on or after the capsule's open date.
 * Date comparison uses date-only precision (no time component) so the
 * capsule opens at the start of the day in the user's local timezone.
 */
export function isCapsuleReady(capsule: CapsuleData): boolean {
  const openDate = new Date(capsule.openDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  openDate.setHours(0, 0, 0, 0);
  return today >= openDate;
}

/**
 * Builds and submits a transaction that seals a time capsule on-chain.
 *
 * The capsule data is stored in the data field of the first output cell.
 * The cell is locked with the sender's standard secp256k1 lock —
 * meaning only the private key holder can later consume (destroy) it.
 *
 * Returns the transaction hash. This hash is the capsule's permanent
 * identifier — anyone with it can retrieve and read the capsule data.
 */
export async function sealCapsule(
  capsule: CapsuleData,
  privateKey: string,
  client: ccc.Client
): Promise<string> {
  const signer = new ccc.SignerCkbPrivateKey(client, privateKey);
  const address = await signer.getRecommendedAddressObj();

  const tx = ccc.Transaction.from({
    outputs: [
      {
        // The sender's lock guards this cell.
        // Only they can spend it — the capsule data is permanent
        // until the owner explicitly chooses to consume the cell.
        lock: address.script,
      },
    ],
    outputsData: [encodeCapsule(capsule)],
  });

  // Select enough live input cells to cover the output's capacity.
  // CKB capacity must be >= cell byte size (structure + data).
  await tx.completeInputsByCapacity(signer);

  // Calculate and deduct the transaction fee at 1000 Shannons/KB.
  await tx.completeFeeBy(signer, 1000n);

  return signer.sendTransaction(tx);
}

/**
 * Retrieves a sealed time capsule from the chain by transaction hash.
 *
 * The capsule cell is always at output index 0 of the sealing transaction.
 * getLiveCell fetches a cell by its OutPoint (txHash + index) without
 * consuming it — read-only access to on-chain state.
 *
 * Returns null if the cell doesn't exist or contains no capsule data.
 */
export async function retrieveCapsule(
  txHash: string,
  client: ccc.Client
): Promise<CapsuleData | null> {
  const cell = await client.getCellLive({ txHash, index: "0x0" }, true);
  if (!cell) return null;
  return decodeCapsule(cell.outputData);
}
