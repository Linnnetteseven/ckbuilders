"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/useWallet";

const SAVED = "ccc-connection-info"; // where the CCC connector keeps the last connection

const short = (a: string) => `${a.slice(0, 7)}…${a.slice(-4)}`;
const savedConnection = () => {
  try { return !!localStorage.getItem(SAVED); } catch { return false; }
};

/**
 * The connected wallet, always visible in the nav: a short address with a
 * copy button, and a small menu (full address, explorer, My capsules,
 * disconnect). The connector remembers the wallet between visits; while it
 * restores, this says "Reconnecting…" instead of offering a false "Connect".
 */
export function WalletChip() {
  const { address, connect, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);

  // A saved connection usually comes back within a second or two; stop waiting after 5
  useEffect(() => {
    if (address || !savedConnection()) return;
    const start = setTimeout(() => setRestoring(true), 0);
    const stop = setTimeout(() => setRestoring(false), 5000);
    return () => { clearTimeout(start); clearTimeout(stop); };
  }, [address]);

  const copy = () => {
    if (!address) return;
    void navigator.clipboard?.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!address) {
    return restoring
      ? <span className="text-ink-2 whitespace-nowrap" aria-live="polite">Reconnecting…</span>
      : <button type="button" className="btn !py-1.5 !px-3.5 !text-xs" onClick={() => void connect()}>Connect</button>;
  }

  return (
    <div className="flex items-center gap-1">
      <details ref={menu} className="relative">
        <summary className="list-none cursor-pointer flex items-center gap-2 rounded-full border-2 border-ink bg-paper px-2.5 sm:px-3 py-1 font-mono text-xs tnum normal-case tracking-normal whitespace-nowrap select-none">
          <span aria-hidden className="w-2 h-2 rounded-full bg-olive shrink-0" />
          <span className="sr-only">Connected wallet</span>
          <span className="sm:hidden">ckt1…{address.slice(-6)}</span>
          <span className="hidden sm:inline">{short(address)}</span>
        </summary>
        <div className="card absolute right-0 mt-2 w-[min(18rem,calc(100vw-2rem))] p-4 space-y-3 z-40 normal-case tracking-normal text-left">
          <p className="label">Connected wallet</p>
          <p className="font-mono text-xs break-all">{address}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn !py-1 !px-3 !text-xs" onClick={copy}>{copied ? "Copied ✓" : "Copy address"}</button>
            <a className="btn btn-ghost !py-1 !px-3 !text-xs" href={`https://testnet.explorer.nervos.org/address/${address}`} target="_blank" rel="noreferrer">Explorer</a>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
            <Link href="/mine" className="underline" onClick={() => menu.current?.removeAttribute("open")}>My capsules</Link>
            <button type="button" className="underline text-tomato" onClick={() => { menu.current?.removeAttribute("open"); void disconnect(); }}>Disconnect</button>
          </div>
        </div>
      </details>
      <button type="button" onClick={copy} aria-label={copied ? "Address copied" : "Copy wallet address"} title="Copy address"
        className="grid place-items-center w-8 h-8 rounded-full border-2 border-ink bg-paper hover:bg-brass transition-colors">
        {copied ? (
          <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.2 4.2L19 7" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
        )}
      </button>
    </div>
  );
}
