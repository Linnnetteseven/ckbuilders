import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { ccc } from "@ckb-ccc/core";
import { CHALLENGE_TTL_MS, uploadMessage } from "@/lib/challenge";
import { OwnershipError, provenLock } from "@/lib/ownership.server";

/**
 * Upload a creator's display image to Vercel Blob.
 *
 * The browser shrinks the image to WebP first (which also drops photo
 * metadata such as location), then the creator's wallet signs a message naming
 * the file's sha256. The file is stored under that wallet's own folder,
 * `creators/<lock hash prefix>/<file hash prefix>.webp`; profiles only accept
 * images from their owner's folder (lib/profiles.ts).
 */
const MAX_BYTES = 1_000_000;
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

const isWebp = (b: Buffer) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP";

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Image uploads aren't switched on yet" }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (recent.length > MAX_PER_WINDOW) return NextResponse.json({ error: "Too many uploads; try again later" }, { status: 429 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a form upload" }, { status: 400 });
  }
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
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is too large (max 1 MB after resizing)" }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!isWebp(bytes)) return NextResponse.json({ error: "Expected a WebP image" }, { status: 415 });
  const digest = createHash("sha256").update(bytes).digest("hex");

  let lock: ccc.Script;
  try {
    lock = await provenLock(new ccc.ClientPublicTestnet(), address, uploadMessage(address, digest, issuedAt), sig as ccc.Signature);
  } catch (e) {
    return NextResponse.json({ error: e instanceof OwnershipError ? e.message : "Could not verify the signature" }, { status: 401 });
  }

  try {
    const blob = await put(`creators/${lock.hash().slice(2, 18)}/${digest.slice(0, 16)}.webp`, bytes, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    console.error("upload error", e);
    return NextResponse.json({ error: "Upload failed; please try again" }, { status: 502 });
  }
}
