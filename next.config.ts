import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir:
    process.env.NODE_ENV === "development"
      ? ".next-study-space-dev"
      : ".next-study-space",
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    const developmentEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value:
          `default-src 'self'; base-uri 'self'; form-action 'self' https://accounts.spotify.com; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'${developmentEval} https://sdk.scdn.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://i.scdn.co https://image-cdn-ak.spotifycdn.com; connect-src 'self' https://api.spotify.com https://accounts.spotify.com https://gew1-spclient.spotify.com wss:; media-src 'self' blob: https://*.scdn.co; font-src 'self'`,
      },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      {
        key: "Permissions-Policy",
        value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
      },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
      const csp = securityHeaders.find(
        (header) => header.key === "Content-Security-Policy",
      );
      if (csp) csp.value += "; upgrade-insecure-requests";
    }
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
