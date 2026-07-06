import { eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/db"
import { integrations } from "@/db/schema"
import { AppHeader } from "@/components/app-header"
import { IntegrationsPanel, type IntegrationView } from "./integrations-panel"

export const metadata = { title: "Settings · DORA Dashboard" }

function toView(
  row:
    | {
        status: "UNCONFIGURED" | "CONNECTED" | "ERROR"
        config: unknown
        encryptedToken: string | null
        lastError: string | null
        lastSyncAt: Date | null
      }
    | undefined
): IntegrationView {
  return {
    status: row?.status ?? "UNCONFIGURED",
    hasToken: Boolean(row?.encryptedToken),
    config: (row?.config as Record<string, string>) ?? {},
    lastError: row?.lastError ?? null,
    lastSyncAt: row?.lastSyncAt ? row.lastSyncAt.toISOString() : null,
  }
}

export default async function SettingsPage() {
  const admin = await requireAdmin()
  const rows = await db.select().from(integrations)
  const github = toView(rows.find((r) => r.provider === "GITHUB"))
  const jira = toView(rows.find((r) => r.provider === "JIRA"))

  return (
    <div className="min-h-screen">
      <AppHeader user={admin} active="settings" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Connect data sources. Tokens are encrypted at rest (AES-256-GCM) and
            never shown again.
          </p>
        </div>
        <IntegrationsPanel github={github} jira={jira} />
      </main>
    </div>
  )
}
