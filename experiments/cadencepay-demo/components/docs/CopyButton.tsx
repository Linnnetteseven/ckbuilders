"use client";
import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      className="text-pink hover:underline normal-case tracking-normal text-xs font-sans font-semibold">{copied ? "Copied" : "Copy"}</button>
  );
}
