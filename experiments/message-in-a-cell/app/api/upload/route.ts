import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { ccc } from "@ckb-ccc/core";
import { CHALLENGE_TTL_MS, uploadMessage } from "@/lib/challenge";
import { OwnershipError, provenLock } from "@/lib/ownership.server";

/**
 * Store an encrypted video or voice note for a capsule.
 *
 * The browser encrypts the file with the capsule's key before upload, so this
 * server only ever sees ciphertext. The sender's wallet signs the file's
 * sha256 (no anonymous uploads), and the capsule records that sha256 so the
 * file can't be swapped later.
 */
const MAX_BYTES = 4_000_000; // stays under Vercel's 4.5 MB request limit
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 6;
const hits = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Video and voice uploads aren't switched on yet" }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (recent.length > MAX_PER_WINDOW) return NextResponse.json({ error: "Too many uploads; try again later" }, { status: 429 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Expected a form upload" }, { status: 400 }); }
  const file = form.get("file");
  const address = form.get("address");
  const issuedAt = Number(form.get("issuedAt"));
  let sig: Partial<ccc.Signature> | undefined;
  try { sig = JSON.parse(String(form.get("signature"))); } catch { sig = undefined; }
  if (!(file instanceof Blob) || typeof address !== "string" || !/^ck[bt]1[0-9a-z]{20,200}$/.test(address) ||
      !Number.isFinite(issuedAt) || !sig || typeof sig.signature !== "string" || typeof sig.identity !== "string" || typeof sig.signType !== "string") {
    return NextResponse.json({ error: "Expected { file, address, issuedAt, signature }" }, { status: 400 });
  }
  if (Math.abs(now - issuedAt) > CHALLENGE_TTL_MS) return NextResponse.json({ error: "Signature expired; please try again" }, { status: 401 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That recording is too large (max 4 MB). Try a shorter one." }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  let lock: ccc.Script;
  try {
    lock = await provenLock(new ccc.ClientPublicTestnet(), address, uploadMessage(address, digest, issuedAt), sig as ccc.Signature);
  } catch (e) {
    return NextResponse.json({ error: e instanceof OwnershipError ? e.message : "Could not verify the signature" }, { status: 401 });
  }
  try {
    const blob = await put(`capsules/${lock.hash().slice(2, 18)}/${digest.slice(0, 32)}.bin`, bytes, {
      access: "public", contentType: "application/octet-stream", addRandomSuffix: false, allowOverwrite: true,
    });
    return NextResponse.json({ url: blob.url, sha256: `0x${digest}`, bytes: bytes.length });
  } catch (e) {
    console.error("upload error", e);
    return NextResponse.json({ error: "Upload failed; please try again" }, { status: 502 });
  }
}
