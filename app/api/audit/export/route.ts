import { NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { auditLogs, users } from "@/db/schema"

const EXPORT_LIMIT = 50000

// Admin-only CSV export of the audit log.
export async function GET() {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const me = await db.select({ role: users.role, status: users.status }).from(users).where(eq(users.id, id)).limit(1)
  if (me[0]?.role !== "ADMIN" || me[0]?.status !== "ACTIVE") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const rows = await db
    .select({
      createdAt: auditLogs.createdAt,
      actorEmail: users.email,
      action: auditLogs.action,
      target: auditLogs.target,
      meta: auditLogs.meta,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(EXPORT_LIMIT)

  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const header = ["time_utc", "actor", "action", "target", "meta"].join(",")
  const lines = rows.map((r) =>
    [r.createdAt.toISOString(), r.actorEmail ?? "", r.action, r.target ?? "", JSON.stringify(r.meta)]
      .map(esc)
      .join(",")
  )
  const csv = [header, ...lines].join("\r\n")
  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
