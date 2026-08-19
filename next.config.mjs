/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    // HSTS is also set by ingress-nginx; harmless to reinforce here.
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js hydration + Tailwind require inline; no external script/style origins.
      // ('unsafe-inline' for scripts is a known Next.js constraint; a nonce-based
      // strict-CSP is a documented follow-up requiring careful browser validation.)
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "frame-src 'none'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
]

// Server Actions (used by the login form) enforce an Origin===Host check. Behind
// a reverse proxy / firewall the forwarded host can differ from the browser
// Origin, which Next.js rejects with 403 ("An unexpected response was received
// from the server"). Declare the public origin(s) so the check passes. Derived
// from the operator's existing public URL (AUTH_URL / NEXTAUTH_URL); extra hosts
// can be added via SERVER_ACTIONS_ALLOWED_ORIGINS (comma-separated host[:port]).
const publicUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL
const allowedOrigins = [
  ...(publicUrl ? [new URL(publicUrl).host] : []),
  ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(",") ?? []),
]
  .map((h) => h.trim())
  .filter(Boolean)

const nextConfig = {
  // NOTE: The reference app used `output: "export"` (static). This product needs
  // SSR + API routes for auth (Entra ID / GitHub OAuth) and data ingestion,
  // so static export is intentionally NOT enabled here.
  // `standalone` produces a self-contained server bundle for a slim Docker image.
  output: "standalone",
  reactStrictMode: true,
  // Don't advertise the framework/version.
  poweredByHeader: false,
  ...(allowedOrigins.length
    ? { experimental: { serverActions: { allowedOrigins } } }
    : {}),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
