import type { Metadata, Viewport } from "next";
import { Alfa_Slab_One, Caveat, Fraunces, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Poster slab for titles, an old-style serif for letters, a hand for margin notes, mono for annotations
const slab = Alfa_Slab_One({ weight: "400", subsets: ["latin"], variable: "--font-slab", display: "swap" });
const serif = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-fraunces", display: "swap" });
const hand = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Message in a Cell", template: "%s · Message in a Cell" },
  description: "Seal a message and some CKB in a cell until a day that matters. When they open it, the message is theirs and so is the CKB.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${slab.variable} ${serif.variable} ${hand.variable} ${mono.variable}`}>
      <body className="antialiased min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
