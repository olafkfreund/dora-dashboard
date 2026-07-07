import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { syncGitlab } from "@/lib/ingest/gitlab"

// Trigger GitLab ingestion. Auth: an admin session, or a shared SYNC_TOKEN
// (Authorization: Bearer <token>) for a scheduler/cron. 404 if neither.
export async function POST(req: Request) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const syncToken = process.env.SYNC_TOKEN
  const tokenOk = Boolean(syncToken && bearer && bearer === syncToken)

  if (!tokenOk) {
    const session = await auth()
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
  }

  const result = await syncGitlab()
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
