import "server-only"
import { eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { jiraIssues, jiraTransitions, jiraSprints, syncState, integrations } from "@/db/schema"
import {
  getJiraConfig,
  detectFieldIds,
  searchIssues,
  listSprints,
  type JiraConfig,
  type JiraFieldIds,
  type JiraIssueRaw,
} from "@/lib/jira"

export interface JiraSyncResult {
  ok: boolean
  message: string
  issues?: number
  sprints?: number
}

function toDate(v: unknown): Date | null {
  if (typeof v !== "string") return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

const isBlocked = (s: string | null) => !!s && /block|on hold|impediment/i.test(s)

/** Derive status transitions + timing signals from an issue's changelog. */
function deriveFromChangelog(issue: JiraIssueRaw, createdAt: Date | null) {
  const histories = (issue.changelog?.histories ?? [])
    .map((h) => ({ at: toDate(h.created), items: h.items }))
    .filter((h): h is { at: Date; items: typeof h.items } => h.at !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime())

  const transitions: Array<{ from: string | null; to: string | null; at: Date }> = []
  for (const h of histories) {
    for (const it of h.items) {
      if (it.field === "status") transitions.push({ from: it.fromString, to: it.toString, at: h.at })
    }
  }

  // First time the issue left its initial status = work started (proxy for In Progress).
  const inProgressAt = transitions[0]?.at ?? null

  // Blocked time: sum spans where the status matched a blocked-like status.
  let blockedSeconds = 0
  let blockStart: Date | null = createdAt && isBlocked(transitions[0]?.from ?? null) ? createdAt : null
  for (const t of transitions) {
    if (isBlocked(t.to) && !blockStart) blockStart = t.at
    else if (!isBlocked(t.to) && blockStart) {
      blockedSeconds += Math.max(0, (t.at.getTime() - blockStart.getTime()) / 1000)
      blockStart = null
    }
  }
  if (blockStart) blockedSeconds += Math.max(0, (Date.now() - blockStart.getTime()) / 1000)

  return { transitions, inProgressAt, blockedSeconds: Math.round(blockedSeconds) }
}

function sprintIdFromField(value: unknown): number | null {
  // Sprint custom field is an array of sprint objects (or legacy strings).
  if (!Array.isArray(value) || value.length === 0) return null
  const last = value[value.length - 1]
  if (last && typeof last === "object" && "id" in last) return Number((last as { id: unknown }).id) || null
  if (typeof last === "string") {
    const m = last.match(/id=(\d+)/)
    return m ? Number(m[1]) : null
  }
  return null
}

async function syncIssues(cfg: JiraConfig, fieldIds: JiraFieldIds): Promise<number> {
  const scope = cfg.projectKeys?.length ? `project in (${cfg.projectKeys.join(",")}) AND ` : ""
  const jql = `${scope}updated >= -${cfg.windowDays}d ORDER BY updated DESC`
  const fields = [
    "summary", "status", "issuetype", "created", "updated", "resolutiondate", "labels", "parent",
    fieldIds.storyPoints, fieldIds.storyPointsAlt, fieldIds.sprint, fieldIds.programIncrement,
    fieldIds.rootCause, fieldIds.defectEnv,
  ]
    .filter(Boolean)
    .join(",")

  // Single-select custom fields come back as { value } (or { name }).
  const optOf = (f: Record<string, unknown>, id?: string): string | null => {
    if (!id) return null
    const v = f[id]
    if (typeof v === "string") return v
    if (v && typeof v === "object") return ((v as { value?: string; name?: string }).value ?? (v as { name?: string }).name) || null
    return null
  }

  // Coalesce the two story-point fields (classic "Story Points" preferred).
  const storyPointsOf = (f: Record<string, unknown>): number | null => {
    const primary = fieldIds.storyPoints ? Number(f[fieldIds.storyPoints]) : NaN
    if (Number.isFinite(primary)) return primary
    const alt = fieldIds.storyPointsAlt ? Number(f[fieldIds.storyPointsAlt]) : NaN
    return Number.isFinite(alt) ? alt : null
  }
  // Program Increment field is an array like ["PI5"] (or objects with value/name).
  const piOf = (f: Record<string, unknown>): string | null => {
    const v = fieldIds.programIncrement ? f[fieldIds.programIncrement] : null
    const first = Array.isArray(v) ? v[0] : v
    if (typeof first === "string") return first
    if (first && typeof first === "object") return String((first as { value?: string; name?: string }).value ?? (first as { name?: string }).name ?? "") || null
    return null
  }

  const issues = await searchIssues(cfg, jql, fields)
  const issueRows: (typeof jiraIssues.$inferInsert)[] = []
  const transitionRows: (typeof jiraTransitions.$inferInsert)[] = []
  for (const issue of issues) {
    const f = issue.fields
    const status = (f.status as { name?: string; statusCategory?: { name?: string } }) ?? {}
    const createdAt = toDate(f.created)
    const { transitions, inProgressAt, blockedSeconds } = deriveFromChangelog(issue, createdAt)
    const summary = (f.summary as string) ?? null
    const programIncrement = piOf(f)
    const parentKey = (f.parent as { key?: string })?.key ?? null
    const storyPoints = storyPointsOf(f)
    const rootCause = optOf(f, fieldIds.rootCause)
    const defectEnv = optOf(f, fieldIds.defectEnv)

    issueRows.push({
      id: issue.key,
      projectKey: issue.key.split("-")[0],
      summary,
      issueType: (f.issuetype as { name?: string })?.name ?? null,
      status: status.name ?? null,
      statusCategory: status.statusCategory?.name ?? null,
      storyPoints,
      sprintId: fieldIds.sprint ? sprintIdFromField(f[fieldIds.sprint]) : null,
      programIncrement,
      parentKey,
      rootCause,
      defectEnv,
      createdAt,
      updatedAt: toDate(f.updated),
      inProgressAt,
      resolvedAt: toDate(f.resolutiondate),
      blockedSeconds,
      labels: (f.labels as string[]) ?? [],
    })
    for (let i = 0; i < transitions.length; i++) {
      const t = transitions[i]
      transitionRows.push({ id: `${issue.key}:${i}`, issueKey: issue.key, fromStatus: t.from, toStatus: t.to, at: t.at })
    }
  }

  // Bulk upsert in chunks — a full-window sync is thousands of issues.
  const chunk = <T>(arr: T[], n: number): T[][] => {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
    return out
  }
  for (const c of chunk(issueRows, 500)) {
    await db
      .insert(jiraIssues)
      .values(c)
      .onConflictDoUpdate({
        target: jiraIssues.id,
        set: {
          summary: sql`excluded.summary`,
          status: sql`excluded.status`,
          statusCategory: sql`excluded."statusCategory"`,
          storyPoints: sql`excluded."storyPoints"`,
          sprintId: sql`excluded."sprintId"`,
          programIncrement: sql`excluded."programIncrement"`,
          parentKey: sql`excluded."parentKey"`,
          rootCause: sql`excluded."rootCause"`,
          defectEnv: sql`excluded."defectEnv"`,
          updatedAt: sql`excluded."updatedAt"`,
          inProgressAt: sql`excluded."inProgressAt"`,
          resolvedAt: sql`excluded."resolvedAt"`,
          blockedSeconds: sql`excluded."blockedSeconds"`,
          labels: sql`excluded.labels`,
          ingestedAt: sql`now()`,
        },
      })
  }
  for (const c of chunk(transitionRows, 1000)) {
    await db
      .insert(jiraTransitions)
      .values(c)
      .onConflictDoUpdate({
        target: jiraTransitions.id,
        set: { fromStatus: sql`excluded."fromStatus"`, toStatus: sql`excluded."toStatus"`, at: sql`excluded.at` },
      })
  }

  await db
    .insert(syncState)
    .values({ id: "JIRA:issues", provider: "JIRA", entity: "issues", lastSyncAt: new Date(), itemCount: issues.length })
    .onConflictDoUpdate({ target: syncState.id, set: { lastSyncAt: new Date(), itemCount: issues.length, lastError: null } })
  return issues.length
}

async function syncSprints(cfg: JiraConfig): Promise<number> {
  const sprints = await listSprints(cfg)
  for (const s of sprints) {
    await db
      .insert(jiraSprints)
      .values({
        id: s.id,
        boardId: s.originBoardId ?? null,
        name: s.name,
        state: s.state,
        startDate: toDate(s.startDate),
        endDate: toDate(s.endDate),
        completeDate: toDate(s.completeDate),
      })
      .onConflictDoUpdate({
        target: jiraSprints.id,
        set: {
          name: s.name,
          state: s.state,
          startDate: toDate(s.startDate),
          endDate: toDate(s.endDate),
          completeDate: toDate(s.completeDate),
          ingestedAt: new Date(),
        },
      })
  }
  await db
    .insert(syncState)
    .values({ id: "JIRA:sprints", provider: "JIRA", entity: "sprints", lastSyncAt: new Date(), itemCount: sprints.length })
    .onConflictDoUpdate({ target: syncState.id, set: { lastSyncAt: new Date(), itemCount: sprints.length, lastError: null } })
  return sprints.length
}

/** Incrementally ingest Jira issues (with changelog) + sprints into Postgres. */
export async function syncJira(): Promise<JiraSyncResult> {
  const cfg = await getJiraConfig()
  if (!cfg) return { ok: false, message: "Jira is not configured — add a base URL, email and API token in Settings." }

  try {
    const fieldIds = await detectFieldIds(cfg)
    const issues = await syncIssues(cfg, fieldIds)
    let sprints = 0
    try {
      sprints = await syncSprints(cfg)
    } catch {
      // Agile API may be unavailable (Jira Core / no boards) — issues still ingested.
    }
    await db
      .update(integrations)
      .set({ status: "CONNECTED", lastSyncAt: new Date(), lastError: null })
      .where(eq(integrations.provider, "JIRA"))
    return {
      ok: true,
      message: `Synced ${issues} issue(s) and ${sprints} sprint(s) from Jira.`,
      issues,
      sprints,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Jira sync failed"
    await db
      .update(integrations)
      .set({ status: "ERROR", lastError: message })
      .where(eq(integrations.provider, "JIRA"))
    return { ok: false, message }
  }
}
