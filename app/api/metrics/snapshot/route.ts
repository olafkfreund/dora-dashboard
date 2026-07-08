import { takeSnapshot } from "@/lib/metrics/snapshot"

export const runtime = "nodejs"

// Cron trigger — captures a metric-history snapshot. Guarded by the shared secret.
export async function POST(req: Request) {
  const secret = process.env.DIGEST_SECRET
  const provided = req.headers.get("x-digest-secret")
  if (!secret || !provided || provided !== secret) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } })
  }
  const result = await takeSnapshot()
  return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } })
}
