import { headers } from "next/headers"
import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/db"
import { integrations, ssoProviders } from "@/db/schema"
import { AppHeader } from "@/components/app-header"
import { IntegrationsPanel, type IntegrationView } from "./integrations-panel"
import { SsoPanel, type SsoView } from "./sso-panel"

export const metadata = { title: "Settings · DORA Dashboard" }

function toIntegrationView(
  row:
    | {
        status: "UNCONFIGURED" | "CONNECTED" | "ERROR"
        config: unknown
        encryptedToken: string | null
        lastError: string | null
      }
    | undefined
): IntegrationView {
  return {
    status: row?.status ?? "UNCONFIGURED",
    hasToken: Boolean(row?.encryptedToken),
    config: (row?.config as Record<string, string>) ?? {},
    lastError: row?.lastError ?? null,
  }
}

function toSsoView(
  row: { enabled: boolean; config: unknown; encryptedSecret: string | null } | undefined
): SsoView {
  return {
    enabled: Boolean(row?.enabled),
    hasSecret: Boolean(row?.encryptedSecret),
    config: (row?.config as { clientId?: string; tenantId?: string }) ?? {},
  }
}

export default async function SettingsPage() {
  const admin = await requireAdmin()
  const [intRows, ssoRows, h] = await Promise.all([
    db.select().from(integrations),
    db.select().from(ssoProviders),
    headers(),
  ])
  const gitlab = toIntegrationView(intRows.find((r) => r.provider === "GITLAB"))
  const github = toIntegrationView(intRows.find((r) => r.provider === "GITHUB"))
  const jira = toIntegrationView(intRows.find((r) => r.provider === "JIRA"))
  const entra = toSsoView(ssoRows.find((r) => r.provider === "ENTRA"))
  const githubOauth = toSsoView(ssoRows.find((r) => r.provider === "GITHUB"))

  const proto = h.get("x-forwarded-proto") ?? "http"
  const host = h.get("host") ?? "localhost:8191"
  const callbackBase = `${proto}://${host}`

  return (
    <div className="min-h-screen">
      <AppHeader user={admin} active="settings" />
      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure authentication and data sources. Secrets are encrypted at
            rest (AES-256-GCM) and never shown again.
          </p>
        </div>

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Single sign-on (SSO)
          </h2>
          <SsoPanel entra={entra} github={githubOauth} callbackBase={callbackBase} />
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Data sources
          </h2>
          <IntegrationsPanel gitlab={gitlab} github={github} jira={jira} />
        </section>
      </main>
    </div>
  )
}
