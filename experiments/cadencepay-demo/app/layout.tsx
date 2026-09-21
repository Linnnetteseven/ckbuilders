import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "CadencePay",
  description: "On-chain subscriptions on CKB. No custodian. No vault.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#F8F6F2] text-[#1C1814] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
