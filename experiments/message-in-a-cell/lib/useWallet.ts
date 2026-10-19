"use client";
import { useEffect, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";

export interface Wallet {
  signer?: ccc.Signer;
  client: ccc.Client;
  address?: string;
  lock?: ccc.Script;
  walletName?: string;
  connect: () => unknown;
  disconnect: () => unknown;
}

/** The connected CCC signer (JoyID or another CKB wallet) plus its address and lock. */
export function useWallet(): Wallet {
  const { open, disconnect, client, wallet } = ccc.useCcc();
  const signer = ccc.useSigner();
  const [account, setAccount] = useState<{ signer: ccc.Signer; address: string; lock: ccc.Script }>();

  useEffect(() => {
    if (!signer) return;
    let cancelled = false;
    void signer.getRecommendedAddressObj().then((a) => {
      if (!cancelled) setAccount({ signer, address: a.toString(), lock: a.script });
    });
    return () => {
      cancelled = true;
    };
  }, [signer]);

  // Ignore an account resolved for a previous signer
  const current = account && account.signer === signer ? account : undefined;

  return {
    signer,
    client,
    address: current?.address,
    lock: current?.lock,
    walletName: wallet?.name,
    connect: open,
    disconnect,
  };
}
