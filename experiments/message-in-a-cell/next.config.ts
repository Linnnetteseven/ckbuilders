import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Encrypted video/voice files and creator-uploaded images live in Vercel Blob
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
};

export default nextConfig;
