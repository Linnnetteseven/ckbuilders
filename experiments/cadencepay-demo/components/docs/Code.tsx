"use client";
import { useState } from "react";

/** A code block with a copy button. */
export function Code({ children, lang }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="not-prose relative my-5 rounded-2xl bg-soft border border-line overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-line font-mono text-[11px] tracking-[0.12em] uppercase text-ink-3">
        <span>{lang ?? "code"}</span>
        <button onClick={() => { void navigator.clipboard?.writeText(children.trim()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
          className="text-pink hover:underline normal-case tracking-normal text-xs font-sans font-semibold">{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre className="px-4 py-4 overflow-x-auto font-mono text-[13px] leading-[1.7] text-ink"><code>{children.trim()}</code></pre>
    </div>
  );
}
