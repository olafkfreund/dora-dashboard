import { desc, eq } from "drizzle-orm"
import { Download } from "lucide-react"
import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/db"
import { auditLogs, users } from "@/db/schema"
import { AppHeader } from "@/components/app-header"
import { Card } from "@/components/ui/card"

export const metadata = { title: "Audit log · DORA Dashboard" }

const RECENT_LIMIT = 200

export default async function AuditPage() {
  const admin = await requireAdmin()
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      target: auditLogs.target,
      meta: auditLogs.meta,
      createdAt: auditLogs.createdAt,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(RECENT_LIMIT)

  return (
    <div className="min-h-screen">
      <AppHeader user={admin} active="audit" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
            <p className="text-sm text-muted-foreground">
              Append-only record of privileged actions (sign-in, user/role changes, integration
              saves, syncs). Showing the {RECENT_LIMIT} most recent.
            </p>
          </div>
          <a
            href="/api/audit/export"
            download
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Download className="size-4" /> Export CSV
          </a>
        </div>

        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Time (UTC)</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No audit entries yet.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {r.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="px-4 py-3 text-xs">{r.actorEmail ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">{r.action}</td>
                  <td className="px-4 py-3 text-xs">{r.target ?? "—"}</td>
                  <td className="px-4 py-3">
                    <code className="block max-w-md overflow-x-auto whitespace-nowrap rounded bg-muted px-2 py-1 text-xs">
                      {JSON.stringify(r.meta)}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>
    </div>
  )
}
