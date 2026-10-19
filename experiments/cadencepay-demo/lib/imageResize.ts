/**
 * Shrink a chosen photo in the browser: centre-crop to a square, at most
 * 1200 px, re-encoded as WebP. Re-encoding through a canvas also drops photo
 * metadata (camera, location) before anything leaves the device.
 */
export async function toSquareWebp(file: File, size = 1200, maxBytes = 950_000): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(size, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't resize images");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  bitmap.close();
  for (const quality of [0.82, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
    if (blob && blob.type === "image/webp" && blob.size <= maxBytes) return blob;
  }
  throw new Error("That image is too detailed to shrink; try another one");
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
