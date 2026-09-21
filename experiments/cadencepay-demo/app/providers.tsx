"use client";
import { KeyWayProvider } from "@ckb-keyway/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <KeyWayProvider appName="CadencePay" theme="dark">
      {children}
    </KeyWayProvider>
  );
}
