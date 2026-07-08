import { headers } from "next/headers"
import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/db"
import { integrations, ssoProviders } from "@/db/schema"
import { AppHeader } from "@/components/app-header"
import { features } from "@/lib/features"
import { getMetricConfig } from "@/lib/metrics/config-store"
import { listTeams, distinctAssignables } from "@/lib/teams/store"
import { IntegrationsPanel, type IntegrationView } from "./integrations-panel"
import { SsoPanel, type SsoView } from "./sso-panel"
import { MetricsPanel } from "./metrics-panel"
import { TeamsPanel } from "./teams-panel"

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

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ metricsTeam?: string }> }) {
  const admin = await requireAdmin()
  const sp = await searchParams
  const metricsTeam = typeof sp.metricsTeam === "string" ? sp.metricsTeam : undefined
  const [intRows, ssoRows, metricCfg, teamList, assignables, h] = await Promise.all([
    db.select().from(integrations),
    db.select().from(ssoProviders),
    getMetricConfig(metricsTeam),
    listTeams(),
    distinctAssignables(),
    headers(),
  ])
  const gitlabRow = intRows.find((r) => r.provider === "GITLAB")
  const gitlab = toIntegrationView(gitlabRow)
  const gitlabLastSync = gitlabRow?.lastSyncAt
    ? gitlabRow.lastSyncAt.toISOString().slice(0, 16).replace("T", " ") + " UTC"
    : null
  // GitHub cards are hidden unless FEATURE_GITHUB is enabled.
  const github = features.github ? toIntegrationView(intRows.find((r) => r.provider === "GITHUB")) : undefined
  const jiraRow = intRows.find((r) => r.provider === "JIRA")
  const jira = toIntegrationView(jiraRow)
  const jiraLastSync = jiraRow?.lastSyncAt
    ? jiraRow.lastSyncAt.toISOString().slice(0, 16).replace("T", " ") + " UTC"
    : null
  const entra = toSsoView(ssoRows.find((r) => r.provider === "ENTRA"))
  const githubOauth = features.github ? toSsoView(ssoRows.find((r) => r.provider === "GITHUB")) : undefined

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
          <IntegrationsPanel gitlab={gitlab} github={github} jira={jira} gitlabLastSync={gitlabLastSync} jiraLastSync={jiraLastSync} />
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Teams
          </h2>
          <TeamsPanel teams={teamList} available={assignables} />
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Metrics
          </h2>
          <MetricsPanel config={metricCfg} teams={teamList} currentTeam={metricsTeam} />
        </section>
      </main>
    </div>
  )
}
