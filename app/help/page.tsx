import type { ComponentType, ReactNode } from "react"
import {
  AlertTriangle,
  BookOpen,
  GitBranch,
  KeyRound,
  ListChecks,
  LayoutGrid,
  SlidersHorizontal,
  FlaskConical,
  Sparkles,
  Users,
  FileDown,
} from "lucide-react"
import { requireUser } from "@/lib/auth-helpers"
import { AppHeader } from "@/components/app-header"
import { Card } from "@/components/ui/card"

export const metadata = { title: "Help & Docs · DORA Dashboard" }

/* ---------- small presentational helpers (local to this page) ---------- */

function Section({
  id,
  icon: Icon,
  title,
  intro,
  children,
}: {
  id: string
  icon: ComponentType<{ className?: string }>
  title: string
  intro?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
          <Icon className="size-4" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {intro && <p className="mb-4 text-sm text-muted-foreground">{intro}</p>}
      {children}
    </section>
  )
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="ml-1 space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
            {i + 1}
          </span>
          <span className="text-foreground/90">{it}</span>
        </li>
      ))}
    </ol>
  )
}

function KV({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <th className="w-1/3 whitespace-nowrap bg-muted/40 px-3 py-2 text-left align-top font-medium">
                {k}
              </th>
              <td className="px-3 py-2 align-top text-muted-foreground">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Note({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  const cls =
    tone === "warn"
      ? "border-amber-500/30 bg-amber-500/10"
      : "border-sky-500/30 bg-sky-500/10"
  return (
    <div className={`flex gap-2 rounded-lg border p-3 text-sm ${cls}`}>
      {tone === "warn" && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />}
      <div className="text-foreground/90">{children}</div>
    </div>
  )
}

const C = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8em]">{children}</code>
)

const Shot = ({ src, alt }: { src: string; alt: string }) => (
  // Static screenshots served from /public/img — plain <img> avoids next/image config.
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} loading="lazy" className="w-full rounded-lg border border-border" />
)

const TOC = [
  ["getting-started", "Getting started"],
  ["gitlab", "1 · Connect GitLab"],
  ["jira", "2 · Connect Jira"],
  ["sso", "3 · Azure Entra ID SSO"],
  ["coverage", "4 · Test Automation Coverage"],
  ["metrics-config", "5 · Fine-tune metric definitions"],
  ["teams", "6 · Teams & filtering"],
  ["decisions", "7 · Two metric decisions"],
  ["reports", "8 · Reports & scheduled digest"],
  ["using", "Using the dashboard"],
  ["at-a-glance", "At a glance"],
  ["metrics-derived", "How each metric is calculated"],
] as const

/* ---------------------------------- page ---------------------------------- */

export default async function HelpPage() {
  const user = await requireUser()

  return (
    <div className="min-h-screen">
      <AppHeader user={user} active="help" />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
            <BookOpen className="size-3.5" /> Help &amp; Docs
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Configure &amp; use the portal</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A precise, step-by-step guide to connecting your data sources, signing in with
            enterprise SSO, and fine-tuning what each metric measures. All secrets are entered in{" "}
            <strong>Settings</strong>, encrypted at rest (AES-256-GCM), and never shown again.
          </p>
        </div>

        {/* table of contents */}
        <Card className="mb-10 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            On this page
          </p>
          <nav className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {TOC.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="text-sm text-primary hover:underline">
                {label}
              </a>
            ))}
          </nav>
        </Card>

        <div className="space-y-12">
          {/* Getting started */}
          <Section
            id="getting-started"
            icon={KeyRound}
            title="Getting started"
            intro="Sign in, then connect your sources. Roles gate what you can do."
          >
            <KV
              rows={[
                ["Admin", "Connect/edit data sources & SSO, configure metric definitions, manage users, view the audit log."],
                ["Lead", "View all dashboards and metric detail; no configuration access."],
                ["Viewer", "Read-only dashboards."],
              ]}
            />
            <div className="mt-4">
              <Steps
                items={[
                  <>Sign in with the bootstrap admin (local username/password) or via SSO once configured.</>,
                  <>Open <strong>Settings</strong> (Admin only) to connect GitLab and Jira.</>,
                  <>After each connection: <strong>Save → Test connection → Sync now</strong>.</>,
                  <>Return to the <strong>Dashboard</strong> — metrics turn live as their source syncs.</>,
                ]}
              />
            </div>
          </Section>

          {/* GitLab */}
          <Section
            id="gitlab"
            icon={GitBranch}
            title="1 · Connect GitLab — primary DORA source (required)"
            intro="Unlocks Deployment Frequency, Change Failure Rate, Lead Time, and MTTR (plus Test Automation Coverage)."
          >
            <KV
              rows={[
                ["Base URL", <><C>https://gitlab.com</C> or your self-managed URL</>],
                ["Group or project path", <>e.g. <C>my-group</C> or <C>my-group/my-project</C> — <em>no</em> host prefix</>],
                ["Production environment name", <>the GitLab environment that counts as production (default <C>production</C>)</>],
                ["Access token", <>a PAT with <C>read_api</C>, <em>or</em> a fine-grained token with group read on Deployment, Pipeline, Environment, Merge Request, Project (add Job / Job-Artifact for coverage)</>],
              ]}
            />
            <div className="mt-4">
              <Steps
                items={[
                  <>In GitLab, create the token: <strong>Settings → Access tokens</strong> (group or personal) with the scopes above.</>,
                  <>In the portal: <strong>Settings → GitLab</strong>. Enter Base URL, group/project path, production environment, and paste the token.</>,
                  <>Click <strong>Save</strong>, then <strong>Test connection</strong> (validates access to your configured group).</>,
                  <>Click <strong>Sync now</strong> to pull deployments, merge requests and pipelines.</>,
                ]}
              />
            </div>
            <div className="mt-4">
              <Note tone="warn">
                Fine-grained tokens often lack <em>User: Read</em>. The app validates access to your
                configured <strong>group</strong> (not <C>/user</C>), so those tokens pass the test.
              </Note>
            </div>
          </Section>

          {/* Jira */}
          <Section
            id="jira"
            icon={ListChecks}
            title="2 · Connect Jira — flow, velocity & quality (required for 7 metrics)"
            intro="Unlocks Cycle Time, Work Item Age, Blocked Time, Average Velocity, Delivery Predictability, Defect Escape Rate, and Defect Root Cause."
          >
            <KV
              rows={[
                ["Base URL", <><C>https://your-org.atlassian.net</C></>],
                ["Service-account email", "a read-only account is ideal"],
                ["API token", "an Atlassian API token for that account"],
                ["Scopes / permissions", "Browse Projects, View Sprints/Boards, read issues + changelog"],
                ["Defect labels (quality)", <>tag bugs with a <C>post-release</C>/<C>production</C> label (escaped defect) and a <C>requirements</C>/<C>design</C> label (upstream root cause)</>],
              ]}
            />
            <div className="mt-4">
              <Steps
                items={[
                  <>Create an Atlassian API token at <strong>id.atlassian.com → Security → API tokens</strong>.</>,
                  <>In the portal: <strong>Settings → Jira</strong>. Enter the base URL, service-account email, and API token.</>,
                  <><strong>Save → Test connection → Sync now</strong> to pull issues, sprints and status changelogs.</>,
                ]}
              />
            </div>
            <Note>
              Story-Points and Sprint custom fields are <strong>auto-detected by name</strong> — no
              field IDs to configure.
            </Note>
          </Section>

          {/* SSO */}
          <Section
            id="sso"
            icon={KeyRound}
            title="3 · Azure Entra ID SSO (optional)"
            intro="Enterprise single sign-on via OIDC. Local username/password keeps working alongside it."
          >
            <KV
              rows={[
                ["Provide", "Application (client) ID, Directory (tenant) ID, and a client secret"],
                ["Redirect URI", <><C>https://&lt;your-host&gt;/api/auth/callback/microsoft-entra-id</C></>],
              ]}
            />
            <div className="mt-4">
              <Steps
                items={[
                  <>In the Azure portal: <strong>Microsoft Entra ID → App registrations → New registration</strong>.</>,
                  <>Set the platform to <strong>Web</strong> and add the redirect URI above (your portal&apos;s HTTPS host).</>,
                  <>Under <strong>Certificates &amp; secrets</strong>, create a <strong>client secret</strong> and copy its value.</>,
                  <>Copy the <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong> from the Overview.</>,
                  <>In the portal: <strong>Settings → Single sign-on → Azure Entra ID</strong>. Paste client ID, tenant ID and secret, then <strong>enable</strong> the provider.</>,
                  <>Sign out and use <strong>&ldquo;Sign in with Microsoft&rdquo;</strong> to verify.</>,
                ]}
              />
            </div>
            <Note tone="warn">
              GitHub OAuth is also supported but hidden behind the <C>FEATURE_GITHUB</C> flag — enable
              that env var to reveal its card. Redirect URI: <C>https://&lt;host&gt;/api/auth/callback/github</C>.
            </Note>
          </Section>

          {/* Coverage */}
          <Section
            id="coverage"
            icon={FlaskConical}
            title="4 · Test Automation Coverage — no new credentials"
            intro="Reuses the existing GitLab token."
          >
            <p className="text-sm text-muted-foreground">
              The only requirement is that your CI pipelines <strong>publish a coverage value</strong>{" "}
              (a coverage regex or a coverage artifact). The app reads each project&apos;s latest
              pipeline coverage and averages it — no extra configuration.
            </p>
          </Section>

          {/* Metric config */}
          <Section
            id="metrics-config"
            icon={SlidersHorizontal}
            title="5 · Fine-tune metric definitions"
            intro={
              <>
                <strong>Settings → Metrics</strong> (Admin only). This is where you resolve the most
                common &ldquo;these numbers look wrong&rdquo; disputes. Every change is audited and
                takes effect on the next dashboard load — <strong>no re-sync required</strong>.
                Leaving everything blank reproduces the standard DORA behaviour.
              </>
            }
          >
            <KV
              rows={[
                ["Production environments", <>only deployments to these environment names count. Comma-separated; <strong>blank = every environment</strong>.</>],
                ["Ref / branch pattern", <>regex the deployment ref must match, e.g. <C>^(main|release/.*)$</C>. Blank = any.</>],
                ["Failure statuses", <>which deployment statuses count as a change failure (deploy-status fallback for CFR). Default <C>failed</C>.</>],
                ["Blocked statuses", <>which Jira statuses count as <strong>Blocked</strong> for Blocked Time (comma-separated). Blank = auto-detect any status named Blocked / On-Hold / Impediment. A status like <C>Defect In Review / Blocked</C> may be a review state, not a true impediment — set the list to exclude it.</>],
                ["Visible cards", <>tick / untick to show or hide any metric card on the dashboard (per org or per team).</>],
                ["Rolling window", "number of weeks of history each metric is computed over (default 8)."],
                ["Benchmark bands", "the Elite / High / Medium thresholds per DORA metric (Low is anything beyond Medium)."],
              ]}
            />
            <div className="mt-4">
              <Steps
                items={[
                  <>Set the environment allowlist / ref pattern / failure statuses to match your pipeline reality.</>,
                  <>Adjust the rolling window and the per-metric bands if your targets differ from the DORA defaults.</>,
                  <><strong>Save definitions</strong> — the dashboard recomputes immediately.</>,
                  <>Use <strong>Reset to DORA defaults</strong> to clear all overrides.</>,
                ]}
              />
            </div>
            <Note>
              <strong>Lineage.</strong> Open any DORA card&apos;s detail view to see an{" "}
              <em>&ldquo;Active rules · lineage&rdquo;</em> panel showing the exact definition behind
              the number — window, environment allowlist, ref pattern, failure statuses, and the band
              thresholds in force. This makes every figure defensible in an audit.
            </Note>
          </Section>

          {/* Teams */}
          <Section
            id="teams"
            icon={Users}
            title="6 · Teams & filtering"
            intro={
              <>
                <strong>Settings → Teams</strong> (Admin). Slice the whole dashboard by squad.
              </>
            }
          >
            <Steps
              items={[
                <>Create a team and tick the <strong>GitLab projects</strong> and <strong>Jira project keys</strong> that belong to it (a team = those projects + keys).</>,
                <>Back on the dashboard, use the <strong>team dropdown</strong> (next to Export) — every metric, breakdown and the exported report recompute for just that team. <strong>All teams</strong> = the org-wide numbers.</>,
                <>Optional: in <strong>Settings → Metrics</strong>, switch the team selector to give a squad its own targets, bands, deployment rules and window (layered over the org default).</>,
              ]}
            />
            <div className="mt-4">
              <Note>
                Filtering is compute-time, so assigning projects to a team needs <strong>no re-sync</strong>.
                Everything stays at team/org level — never individuals.
              </Note>
            </div>
          </Section>

          {/* Two decisions */}
          <Section
            id="decisions"
            icon={SlidersHorizontal}
            title="7 · How key metrics are sourced"
            intro="A few metrics can be measured more than one way — here's what drives them and how to switch."
          >
            <KV
              rows={[
                ["Lead Time", "Keep GitOps (deploy-commit ≈ 0 for infra repos) or measure from the feature MR's first commit (more meaningful for feature-branch workflows)."],
                ["Change Failure Rate", <>Read from Jira <strong>Incidents + Production-environment defects</strong> ÷ production deployments — a failed GitLab deploy <em>job</em> is a job error, not a production failure. Falls back to failed-deploy-status when no incident data exists.</>],
                ["MTTR", <>Incident recovery from Jira Incidents + Production defects (<C>resolved − created</C>); or the deploy-recovery proxy (failed → next success). Switch via <strong>MTTR source</strong>.</>],
                ["Blocked Time", <>Which Jira statuses count as blocked is configurable (blank = auto-detect). Measured against the lifetime of items that were <em>ever</em> blocked, so it isn&apos;t diluted by all other work.</>],
              ]}
            />
          </Section>

          {/* Reports & digest */}
          <Section
            id="reports"
            icon={FileDown}
            title="8 · Reports & scheduled digest"
            intro="Export the full picture, or have it delivered on a schedule."
          >
            <KV
              rows={[
                ["Export PDF / CSV", <>buttons on the dashboard produce a branded <strong>delivery report</strong> — every metric with its tier, drill-down breakdowns, and an auto-generated <strong>“Needs attention”</strong> section. Honours the selected team.</>],
                ["Scheduled digest", <><strong>Settings → Notifications</strong>: send a recurring digest by <strong>email</strong> (PDF attached) or a <strong>Teams/Slack webhook</strong>, optionally scoped to one team. Use <strong>Send test now</strong> to verify.</>],
                ["Scheduling", <>driven by a Kubernetes CronJob — set <C>digest.enabled</C> and <C>digest.schedule</C> in the Helm chart; the app sends it when the CronJob calls <C>/api/digest/run</C> with the shared secret.</>],
              ]}
            />
            <div className="mt-4">
              <Note>
                Nothing leaves the cluster except your configured mail/webhook target — no third-party
                services.
              </Note>
            </div>
          </Section>

          {/* Using the dashboard */}
          <Section
            id="using"
            icon={LayoutGrid}
            title="Using the dashboard"
            intro="Three views of the same metrics — switch with the toggle at the top of the dashboard. Every card is clickable."
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <figure className="space-y-2">
                <Shot src="/img/cards.png" alt="Cards view — compact KPI cards grouped by DORA-4, Flow, and Velocity & Quality" />
                <figcaption className="text-xs text-muted-foreground">
                  <strong>Cards</strong> — dense KPI cards for a quick executive glance.
                </figcaption>
              </figure>
              <figure className="space-y-2">
                <Shot src="/img/charts.png" alt="Charts view — colored per-metric bar charts" />
                <figcaption className="text-xs text-muted-foreground">
                  <strong>Charts</strong> — per-metric trend charts with targets.
                </figcaption>
              </figure>
              <figure className="space-y-2">
                <Shot src="/img/modern.png" alt="Modern view — animated, colorful metric tiles" />
                <figcaption className="text-xs text-muted-foreground">
                  <strong>Modern</strong> — animated tiles with gauges and healthy/watch signals.
                </figcaption>
              </figure>
              <figure className="space-y-2">
                <Shot src="/img/detail.png" alt="Metric detail modal with trend, definition, formula and lineage" />
                <figcaption className="text-xs text-muted-foreground">
                  <strong>Detail</strong> — click any card for definition, formula, target, trend,
                  performance tier, and the lineage panel.
                </figcaption>
              </figure>
            </div>
            <div className="mt-4">
              <Note>
                <Sparkles className="mr-1 inline size-3.5 text-primary" />
                A green <strong>&ldquo;live&rdquo;</strong> badge means the value is computed from your
                connected data; cards without it show sample values until that source is connected.
              </Note>
            </div>
            <div className="mt-3">
              <Note>
                <strong>Trend charts.</strong> The bar/area charts draw from <strong>real captured
                history</strong> — a snapshot job records every metric&apos;s value on a schedule (every
                6h by default). Point-in-time metrics (Work Item Age, Coverage, …) start with a flat
                line and fill in as history accumulates, so the trend reflects genuine change over time.
              </Note>
            </div>
          </Section>

          {/* At a glance */}
          <Section
            id="at-a-glance"
            icon={ListChecks}
            title="At a glance — what lights up each metric group"
          >
            <KV
              rows={[
                ["DORA-4 (4 metrics)", "GitLab token + group + production environment"],
                ["Flow + Velocity + Quality (7 metrics)", "Jira URL + email + API token"],
                ["Test Automation Coverage (1 metric)", "GitLab pipelines that publish coverage"],
                ["Enterprise sign-in", "Entra ID (and/or GitHub OAuth) app registration"],
              ]}
            />
          </Section>

          {/* How each metric is calculated */}
          <Section
            id="metrics-derived"
            icon={FlaskConical}
            title="How each metric is calculated (fields & formulas)"
            intro={
              <>
                Every metric is computed from ingested data, never a live query. Jira custom fields
                vary per instance, so the ingestor <strong>auto-detects them by name</strong> (the IDs
                shown are this instance&apos;s). From each issue&apos;s changelog we derive{" "}
                <C>inProgressAt</C>, <C>resolvedAt</C> and <C>blockedSeconds</C> once at ingest. The{" "}
                <strong>full window</strong> of issues is ingested, and <strong>sub-tasks are
                excluded</strong> from flow, velocity and allocation (they sit under Stories and would
                double-count).
              </>
            }
          >
            <p className="mb-2 text-sm font-medium">DORA-4 — GitLab (change failures from Jira)</p>
            <KV
              rows={[
                ["Deployment Frequency", "successful production deployments ÷ weeks in the window."],
                ["Lead Time for Changes", "median(deployment finished − deployed commit / MR first commit)."],
                ["Change Failure Rate", <>Jira <strong>Incidents + Production-environment defects</strong> in the window ÷ GitLab production deployments (falls back to failed deploy status if no incident data).</>],
                ["Mean Time to Restore", "median(resolved − created) of Jira Incidents + Production defects; or the deploy-recovery proxy."],
              ]}
            />
            <p className="mb-2 mt-5 text-sm font-medium">Flow, Velocity &amp; Quality — Jira</p>
            <KV
              rows={[
                ["Cycle Time", <>median(resolved − <strong>created</strong>) for completed items (excludes sub-tasks). Drill-down breaks it down per <strong>Programme Increment</strong>, counting each issue in every PI it belongs to.</>],
                ["Work Item Age", "mean(now − work-started) for open in-progress items."],
                ["Blocked Time", <>time in a blocked status ÷ lifetime of the items that were <em>ever</em> blocked (blocked statuses configurable).</>],
                ["Feature Cycle Time", <>median(resolved − started) across <strong>Features</strong> (parent issue type); breakdown by Program Increment.</>],
                ["Average Velocity", <>mean completed <strong>story points</strong> (<C>Story Points</C> field) per <strong>Program Increment</strong> (P1–P6) — the team plans in PIs, not sprints.</>],
                ["Delivery Predictability", "completed ÷ committed story points per Program Increment (mean across PIs)."],
                ["Investment Allocation", "story points (weighted) by issue type + labels → Feature / KTLO / Tech-debt / Support."],
                ["Defect Escape Rate", <>defects whose <strong>Environment Type</strong> is Production ÷ defects with an environment set.</>],
                ["Defect Root Cause", <>defects grouped by the <strong>Root Cause Analysis</strong> field; headline = (Requirements + Design) ÷ triaged defects.</>],
                ["Test Automation Coverage", "mean of each project's latest GitLab CI pipeline coverage %."],
                ["PR Cycle Time", "median(first commit → merge) across merged MRs, split into Coding / Pickup / Review / Deploy stages."],
              ]}
            />
            <div className="mt-4 space-y-3">
              <Note>
                <strong>Jira fields used (auto-detected by name).</strong> Story Points (<C>cf10002</C>,
                preferred over the sparsely-used &ldquo;Story point estimate&rdquo;), Program Increment
                (<C>cf10001</C>, P1–P6), parent <strong>Feature</strong>, Root Cause Analysis (
                <C>cf10004</C>), Environment Type (<C>cf10005</C>). If a field is absent on another
                instance, the metric falls back to labels.
              </Note>
              <Note>
                <strong>Why change failures come from Jira.</strong> GitLab showed all deploys
                succeeding and 0 failed, so a deploy-status CFR reads a misleading 0%. The real failure
                signal — production incidents and production defects — lives in Jira, so CFR and
                incident-MTTR read from there.
              </Note>
              <Note>
                <strong>Blocked Time is measured against blocked items only.</strong> Dividing by every
                item&apos;s lifetime diluted it to ~1%; using just the items that were ever blocked
                gives an honest figure. Which statuses count is configurable, because a status like{" "}
                <C>Defect In Review / Blocked</C> can be a review state rather than a true impediment.
              </Note>
            </div>
          </Section>
        </div>
      </main>
    </div>
  )
}
