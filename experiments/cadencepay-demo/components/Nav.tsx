"use client";
import Link from "next/link";
import { useKeyWay } from "@ckb-keyway/react";

export function Nav() {
  const { ready, authenticated, connection, login, logout } = useKeyWay();
  const address = connection?.wallet.ckbAddress;
  const short   = address ? `${address.slice(0,8)}…${address.slice(-4)}` : null;

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-[#F8F6F2]/90 backdrop-blur-sm border-b border-[#DDD9D3]">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-full bg-[#C44F6B]" />
          <span className="font-semibold text-sm tracking-tight">CadencePay</span>
        </Link>

        <div className="flex items-center gap-1">
          <Link href="/creator"
            className="text-sm text-[#7C7570] hover:text-[#1C1814] transition px-3 py-1.5 rounded hidden sm:block">
            Creator
          </Link>
          <Link href="/dashboard"
            className="text-sm text-[#7C7570] hover:text-[#1C1814] transition px-3 py-1.5 rounded hidden sm:block">
            Dashboard
          </Link>

          {!ready ? (
            <div className="h-8 w-24 bg-[#EFECE7] rounded animate-pulse" />
          ) : authenticated && short ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#7C7570] hidden sm:block">{short}</span>
              <button onClick={() => void logout()}
                className="text-xs border border-[#DDD9D3] hover:border-[#C44F6B] hover:text-[#C44F6B] transition px-3 py-1.5 rounded">
                Log out
              </button>
            </div>
          ) : (
            <button onClick={login}
              className="text-sm bg-[#1C1814] hover:bg-[#C44F6B] transition text-white px-4 py-1.5 rounded font-medium">
              Connect
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
