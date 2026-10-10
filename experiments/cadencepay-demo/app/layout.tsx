import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "CadencePay: memberships on CKB", template: "%s · CadencePay" },
  description:
    "Support creators with on-chain memberships. You fund your own Subscription Cell; creators can take at most the agreed amount per period; cancel any time. CKB testnet demo.",
  openGraph: {
    title: "CadencePay: memberships on CKB",
    description: "Creators get paid on schedule. You keep custody and can cancel any time.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F8F6F2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-ink antialiased min-h-dvh">
        <a href="#main" className="skip-link">Skip to content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
