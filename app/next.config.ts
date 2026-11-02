import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep local compilation and page generation within this machine's memory limits.
  experimental: { cpus: 1, webpackMemoryOptimizations: true },
  // Build directly into the project's standard .next output, without a disk cache.
  webpack(config) {
    config.cache = false;
    return config;
  },
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'" },
    ] }];
  },
  // Lint runs as its own CI gate (`npm run lint`); keep builds focused on types + compile.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
