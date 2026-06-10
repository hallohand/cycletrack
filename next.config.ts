import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

// GitHub Pages serves the app under /cycletrack — the deploy workflow sets
// NEXT_PUBLIC_BASE_PATH. Locally the app runs at the root.
// IMPORTANT: this must be our own config (not injected by configure-pages),
// otherwise the withPWA wrapper is skipped and no service worker is built.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
  },
});

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: {
    unoptimized: true,
  },
};

export default withPWA(nextConfig);
