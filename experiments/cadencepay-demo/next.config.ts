import type { NextConfig } from "next";

// No COOP/COEP headers: they were only needed for KeyWay's browser WASM
// Fiber node, and `Cross-Origin-Opener-Policy: same-origin` breaks the
// JoyID signing popup.
const nextConfig: NextConfig = {
  // Creator display images uploaded through /api/upload
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/creators/**" }] },
  async redirects() {
    // The demo moved under /app when / became the landing page; keep old links working
    return [
      { source: "/subscribe", destination: "/app/c/wanjiru-frames/join/supporter", permanent: false },
      { source: "/c/:path*", destination: "/app/c/:path*", permanent: true },
      { source: "/dashboard", destination: "/app/dashboard", permanent: true },
      { source: "/creator", destination: "/app/creator", permanent: true },
      { source: "/how-it-works", destination: "/app/how-it-works", permanent: true },
    ];
  },
};

export default nextConfig;
