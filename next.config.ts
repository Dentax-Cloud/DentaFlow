import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "https://dentax.cloud",
    "https://www.dentax.cloud",
    "http://dentax.cloud",
    "http://www.dentax.cloud",
  ],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "utfs.io" }],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  // geoip-lite ships its IP-to-country data as .dat files it reads via a path relative to its
  // own package directory at runtime (fs.readFileSync, not an import). Letting webpack bundle
  // it into the server build moves its code into .next/server/... without those data files,
  // so the lookup fails at runtime with ENOENT for .next/server/data/geoip-country.dat. Marking
  // it external keeps it as a normal `require("geoip-lite")` resolved from node_modules at
  // runtime instead, where its data files actually live.
  serverExternalPackages: ["geoip-lite"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
