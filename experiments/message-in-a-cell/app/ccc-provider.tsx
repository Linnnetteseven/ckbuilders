"use client";
import { ccc } from "@ckb-ccc/connector-react";

// Module-level so the Provider props stay stable across renders
// (a new client or filter each render would restart the wallet refresh).
const client = new ccc.ClientPublicTestnet();

// CKB-native signers only (JoyID, UTXO Global, …): capsules name CKB locks,
// so the sender and recipient must use CKB wallets.
const ckbOnly = async (signerInfo: ccc.SignerInfo) => signerInfo.signer.type === ccc.SignerType.CKB;

export function CccProvider({ children }: { children: React.ReactNode }) {
  return (
    <ccc.Provider name="Message in a Cell" defaultClient={client} hideKhie signerFilter={ckbOnly}>
      {children}
    </ccc.Provider>
  );
}
