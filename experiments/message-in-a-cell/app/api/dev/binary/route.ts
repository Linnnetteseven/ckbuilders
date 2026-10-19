import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Local development only: serves the built capsule-lock binary to the /deploy page.
export async function GET() {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bin = await readFile(resolve(process.cwd(), "../time-lock-script/build/release/capsule-lock"));
  return NextResponse.json({ hex: `0x${bin.toString("hex")}` });
}
