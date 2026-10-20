import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { ccc } from "@ckb-ccc/core";
import { PROFILE_TYPE, imagePath, imageUrl, spendsLock } from "@/lib/profiles";

/**
 * Upload a creator's display image to Vercel Blob.
 *
 * The browser shrinks the image to WebP first (which also drops photo
 * metadata such as location). The image's URL is fixed by the owner's lock
 * and the file's sha256, so the browser puts it in the profile transaction,
 * sends that, then uploads here with the transaction hash. No extra signature:
 * the upload is accepted only if that transaction creates a profile naming
 * exactly this file and also spends a cell with the profile's lock, i.e. the
 * owner signed it. The file goes in the owner's folder,
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
  const txHash = form.get("txHash");
  if (!(file instanceof Blob) || typeof txHash !== "string" || !/^0x[0-9a-f]{64}$/.test(txHash)) {
    return NextResponse.json({ error: "Expected { file, txHash }" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is too large (max 1 MB after resizing)" }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!isWebp(bytes)) return NextResponse.json({ error: "Expected a WebP image" }, { status: 415 });
  const digest = createHash("sha256").update(bytes).digest("hex");

  // The transaction may still be on its way to our node: the browser retries on 409
  const client = new ccc.ClientPublicTestnet();
  let lock: ccc.Script | undefined;
  try {
    const res = await client.getTransaction(txHash);
    if (!res || res.status === "rejected" || res.status === "unknown") {
      recent.pop(); // waiting for the tx to arrive isn't counted against the upload limit
      return NextResponse.json({ error: "Your page's transaction isn't on the network yet" }, { status: 409 });
    }
    const tx = res.transaction;
    const i = tx.outputs.findIndex((o, k) => {
      if (!o.type?.eq(PROFILE_TYPE)) return false;
      try { return JSON.parse(ccc.bytesTo(tx.outputsData[k] ?? "0x", "utf8")).img === imageUrl(o.lock, digest); } catch { return false; }
    });
    if (i >= 0 && (await spendsLock(client, tx, tx.outputs[i].lock))) lock = tx.outputs[i].lock;
  } catch (e) {
    console.error("upload check error", e);
    return NextResponse.json({ error: "Couldn't check your page's transaction; please try again" }, { status: 502 });
  }
  if (!lock) return NextResponse.json({ error: "That transaction doesn't publish this image" }, { status: 403 });

  try {
    const blob = await put(imagePath(lock, digest), bytes, {
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
