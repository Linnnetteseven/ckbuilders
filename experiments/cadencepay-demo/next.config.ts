import type { NextConfig } from "next";

// No COOP/COEP headers: they were only needed for KeyWay's browser WASM
// Fiber node, and `Cross-Origin-Opener-Policy: same-origin` breaks the
// JoyID signing popup.
const nextConfig: NextConfig = {
  async redirects() {
    // Old demo link; the subscribe flow now lives on each creator's page
    return [{ source: "/subscribe", destination: "/c/wanjiru-frames/join/supporter", permanent: false }];
  },
};

export default nextConfig;
