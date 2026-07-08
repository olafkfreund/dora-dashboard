import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { integrations } from "@/db/schema"
import { decryptSecret } from "@/lib/crypto"

export interface JiraConfig {
  baseUrl: string
  email: string
  token: string
  /** Optional comma-separated project keys to scope ingestion (else all accessible). */
  projectKeys?: string[]
  /** How many days back to ingest (default 180). */
  windowDays: number
}

/** Load and decrypt the configured Jira integration, or null if unconfigured. */
export async function getJiraConfig(): Promise<JiraConfig | null> {
  const rows = await db.select().from(integrations).where(eq(integrations.provider, "JIRA")).limit(1)
  const row = rows[0]
  if (!row?.encryptedToken) return null
  const cfg = (row.config ?? {}) as { baseUrl?: string; email?: string; projectKeys?: string; windowDays?: number }
  if (!cfg.baseUrl || !cfg.email) return null
  let token: string
  try {
    token = decryptSecret(row.encryptedToken)
  } catch {
    return null
  }
  return {
    baseUrl: cfg.baseUrl.replace(/\/$/, ""),
    email: cfg.email,
    token,
    projectKeys: cfg.projectKeys
      ? cfg.projectKeys.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
    windowDays: cfg.windowDays ?? 180,
  }
}

function authHeaders(cfg: JiraConfig) {
  const basic = Buffer.from(`${cfg.email}:${cfg.token}`).toString("base64")
  return { Authorization: `Basic ${basic}`, Accept: "application/json" }
}

async function jiraGet<T = unknown>(cfg: JiraConfig, path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${cfg.baseUrl}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url, { headers: authHeaders(cfg) })
  if (!res.ok) throw new Error(`Jira ${path} → ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export interface JiraFieldIds {
  storyPoints?: string
  storyPointsAlt?: string
  sprint?: string
  programIncrement?: string
  rootCause?: string
  defectEnv?: string
}

/** Auto-detect the custom-field ids (they vary per instance). Prefers the classic "Story Points". */
export async function detectFieldIds(cfg: JiraConfig): Promise<JiraFieldIds> {
  try {
    const fields = await jiraGet<Array<{ id: string; name: string }>>(cfg, "/rest/api/3/field")
    const byName = (name: string) => fields.find((f) => f.name.toLowerCase() === name)?.id
    return {
      // Prefer the classic "Story Points" field; keep "Story point estimate" as a fallback to coalesce.
      storyPoints: byName("story points") ?? byName("story point estimate"),
      storyPointsAlt: byName("story point estimate"),
      sprint: byName("sprint"),
      programIncrement: byName("program increment"),
      rootCause: byName("root cause analysis") ?? byName("root cause"),
      defectEnv: byName("environment type"),
    }
  } catch {
    return {}
  }
}

export interface JiraIssueRaw {
  key: string
  fields: Record<string, unknown>
  changelog?: { histories: Array<{ created: string; items: Array<{ field: string; fromString: string | null; toString: string | null }> }> }
}

/**
 * Paginate a JQL search, expanding the changelog. Bounded by maxIssues.
 *
 * Uses the enhanced JQL search endpoint `/rest/api/3/search/jql`. Atlassian removed
 * the classic `/rest/api/3/search` (now returns 410 Gone). The enhanced endpoint is
 * cursor-paginated via `nextPageToken` and does NOT return a `total`; iterate until
 * `nextPageToken` is absent (or `isLast`).
 */
export async function searchIssues(cfg: JiraConfig, jql: string, fields: string, maxIssues = 50000): Promise<JiraIssueRaw[]> {
  const out: JiraIssueRaw[] = []
  const maxResults = 100
  let nextPageToken: string | undefined
  while (out.length < maxIssues) {
    const params: Record<string, string | number> = { jql, maxResults, fields, expand: "changelog" }
    if (nextPageToken) params.nextPageToken = nextPageToken
    const page = await jiraGet<{ issues: JiraIssueRaw[]; nextPageToken?: string; isLast?: boolean }>(
      cfg,
      "/rest/api/3/search/jql",
      params
    )
    out.push(...(page.issues ?? []))
    if (!page.issues?.length || page.isLast || !page.nextPageToken) break
    nextPageToken = page.nextPageToken
  }
  return out
}

export interface JiraSprintRaw {
  id: number
  state: string
  name: string
  startDate?: string
  endDate?: string
  completeDate?: string
  originBoardId?: number
}

/** List boards, then their sprints (bounded). */
export async function listSprints(cfg: JiraConfig, maxBoards = 20): Promise<JiraSprintRaw[]> {
  const boards = await jiraGet<{ values: Array<{ id: number }> }>(cfg, "/rest/agile/1.0/board", { maxResults: maxBoards })
  const out: JiraSprintRaw[] = []
  for (const b of boards.values ?? []) {
    try {
      const s = await jiraGet<{ values: JiraSprintRaw[] }>(cfg, `/rest/agile/1.0/board/${b.id}/sprint`, { maxResults: 50 })
      for (const sp of s.values ?? []) out.push({ ...sp, originBoardId: sp.originBoardId ?? b.id })
    } catch {
      // board without a sprint API (kanban) — skip
    }
  }
  return out
}
