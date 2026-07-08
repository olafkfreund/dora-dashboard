import { sendDigest } from "@/lib/digest/send"

export const runtime = "nodejs"

// Cron trigger — called by the scheduled CronJob with the shared DIGEST_SECRET header.
// Respects the enabled flag (only sends when the digest is turned on).
export async function POST(req: Request) {
  const secret = process.env.DIGEST_SECRET
  const provided = req.headers.get("x-digest-secret")
  if (!secret || !provided || provided !== secret) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } })
  }
  const result = await sendDigest()
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 400,
    headers: { "Content-Type": "application/json" },
  })
}
