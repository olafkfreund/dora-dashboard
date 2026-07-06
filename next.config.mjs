/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: The reference app used `output: "export"` (static). This product needs
  // SSR + API routes for auth (Entra ID / GitHub OAuth) and data ingestion,
  // so static export is intentionally NOT enabled here.
  reactStrictMode: true,
}

export default nextConfig
