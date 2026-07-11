import type { NextConfig } from "next";

// Baseline security headers on every response. This app's API is same-origin only, so we do
// NOT emit permissive CORS (Access-Control-Allow-Origin), cross-origin browser reads stay
// blocked by the same-origin policy. Stripe webhooks are server-to-server, where CORS doesn't
// apply; they're protected by signature verification, not headers.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
