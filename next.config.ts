import type { NextConfig } from "next";

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
};

export default nextConfig;
