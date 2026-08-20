import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// No nonces here deliberately — nonce-based CSP requires every single page
// to be dynamically rendered (no static optimization/ISR anywhere in the
// app), which is a much bigger change than "add security headers" should
// be, and a real risk to get subtly wrong on a site that processes live
// payments. 'unsafe-inline' for scripts is the tradeoff Next.js's own docs
// name for apps that don't need nonces — it still blocks any *external*
// script source not explicitly allowlisted below, which is the actual
// attack this is meant to stop.
//
// Domains present:
// - Square Web Payments SDK: web.squarecdn.com (prod) + sandbox.web.squarecdn.com
//   (Preview still runs Sandbox) — script/style/img per what the SDK
//   actually loads in practice (verified by running the real payment flow
//   and checking for CSP violations — Square's own docs list a narrower
//   set than what it actually requests), plus their PCI connect/font/Sentry
//   hosts and the Cash App Pay font + Google Pay script it bundles even
//   though this app only surfaces Card/Apple Pay/Google Pay.
// - Supabase: Realtime Broadcast (wss), Storage-hosted profile/logo images.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://web.squarecdn.com https://sandbox.web.squarecdn.com https://pay.google.com;
  style-src 'self' 'unsafe-inline' https://web.squarecdn.com https://sandbox.web.squarecdn.com;
  img-src 'self' blob: data: https://jytxtbmxyzvhteglzqbi.supabase.co https://web.squarecdn.com https://sandbox.web.squarecdn.com;
  font-src 'self' https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net https://cash-f.squarecdn.com;
  connect-src 'self' https://web.squarecdn.com https://sandbox.web.squarecdn.com https://pci-connect.squareup.com https://pci-connect.squareupsandbox.com https://o160250.ingest.sentry.io https://pay.google.com https://google.com https://jytxtbmxyzvhteglzqbi.supabase.co wss://jytxtbmxyzvhteglzqbi.supabase.co;
  frame-src 'self' https://web.squarecdn.com https://sandbox.web.squarecdn.com https://pay.google.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  // Default Server Action body limit is 1MB — too small for real profile/logo
  // photo uploads (src/actions/settings.ts). Supabase's "branding" bucket
  // itself caps files at 5MB, so this just needs enough headroom above that
  // for multipart overhead.
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
