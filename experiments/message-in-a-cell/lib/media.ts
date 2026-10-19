"use client";
import { ccc } from "@ckb-ccc/core";
import { encrypt, decrypt, sha256, MEDIA_KIND, type Media } from "@/lib/capsule";
import { uploadMessage } from "@/lib/challenge";

/** Draw an image into a square canvas and export WebP (drops photo metadata such as location). */
async function squareWebp(file: Blob, size: number, quality: number, blurPx = 0): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(size, side);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images");
  if (blurPx) ctx.filter = `blur(${blurPx}px)`;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
  if (!blob) throw new Error("Couldn't process that image");
  return new Uint8Array(await blob.arrayBuffer());
}

/** The photo stored (encrypted) inside the cell: small, because every byte locks 1 CKB. */
export const photoForCell = (file: Blob) => squareWebp(file, 480, 0.72);
/** A tiny blurred preview shown before opening (not encrypted, a few hundred bytes). */
export const blurredThumb = (file: Blob) => squareWebp(file, 28, 0.5, 2);

/**
 * Encrypt a recording with the capsule key, have the sender's wallet sign its
 * fingerprint, and upload it. Returns the reference stored in the cell.
 */
export async function uploadRecording(kind: "video" | "voice", file: Blob, key: Uint8Array, signer: ccc.Signer, address: string): Promise<Media> {
  const { nonce, ciphertext } = await encrypt(key, new Uint8Array(await file.arrayBuffer()));
  const payload = ccc.bytesConcat(nonce, ciphertext);
  const digest = await sha256(payload);
  const issuedAt = Number(new Date());
  const signature = await signer.signMessage(uploadMessage(address, digest.slice(2), issuedAt));
  const form = new FormData();
  form.set("file", new Blob([payload as BlobPart]), "capsule.bin");
  form.set("address", address);
  form.set("issuedAt", String(issuedAt));
  form.set("signature", JSON.stringify(signature));
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const d = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !d.url) throw new Error(d.error ?? "Upload failed");
  return { kind: MEDIA_KIND[kind], sha256: digest, url: d.url, bytes: payload.length };
}

/** Fetch, check the fingerprint recorded in the cell, decrypt, and return a playable URL. */
export async function playableRecording(ref: Media, key: Uint8Array): Promise<string> {
  const payload = new Uint8Array(await (await fetch(ref.url)).arrayBuffer());
  if ((await sha256(payload)) !== ref.sha256) throw new Error("This recording was changed after sealing");
  const plain = await decrypt(key, payload.slice(0, 12), payload.slice(12));
  const isMp4 = new TextDecoder().decode(plain.slice(4, 8)) === "ftyp";
  const type = ref.kind === MEDIA_KIND.voice ? (isMp4 ? "audio/mp4" : "audio/webm") : isMp4 ? "video/mp4" : "video/webm";
  return URL.createObjectURL(new Blob([plain as BlobPart], { type }));
}

export const MAX_RECORDING_BYTES = 3_900_000;
export const MAX_RECORDING_SECS = 30;
