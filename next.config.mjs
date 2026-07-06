/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: The reference app used `output: "export"` (static). This product needs
  // SSR + API routes for auth (Entra ID / GitHub OAuth) and data ingestion,
  // so static export is intentionally NOT enabled here.
  // `standalone` produces a self-contained server bundle for a slim Docker image.
  output: "standalone",
  reactStrictMode: true,
}

export default nextConfig
