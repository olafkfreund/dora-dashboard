import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { integrations } from "@/db/schema"
import { decryptSecret } from "@/lib/crypto"

export interface GitlabConfig {
  baseUrl: string
  token: string
  group?: string
}

/** Load and decrypt the configured GitLab integration, or null if unconfigured. */
export async function getGitlabConfig(): Promise<GitlabConfig | null> {
  const rows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.provider, "GITLAB"))
    .limit(1)
  const row = rows[0]
  if (!row?.encryptedToken) return null
  const cfg = (row.config ?? {}) as { baseUrl?: string; group?: string }
  let token: string
  try {
    token = decryptSecret(row.encryptedToken)
  } catch {
    return null
  }
  return {
    baseUrl: (cfg.baseUrl || "https://gitlab.com").replace(/\/$/, ""),
    token,
    group: cfg.group || undefined,
  }
}

function apiUrl(baseUrl: string, path: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${baseUrl}/api/v4${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  return url
}

/** Fetch all pages of a GitLab list endpoint (bounded by maxPages). */
export async function gitlabPaginate<T = unknown>(
  cfg: GitlabConfig,
  path: string,
  params: Record<string, string | number> = {},
  maxPages = 20
): Promise<T[]> {
  const out: T[] = []
  let page = 1
  for (let i = 0; i < maxPages; i++) {
    const url = apiUrl(cfg.baseUrl, path, { per_page: 100, page, ...params })
    const res = await fetch(url, {
      headers: { "PRIVATE-TOKEN": cfg.token, Accept: "application/json" },
    })
    if (!res.ok) {
      throw new Error(`GitLab ${path} → ${res.status} ${res.statusText}`)
    }
    const batch = (await res.json()) as T[]
    out.push(...batch)
    const next = res.headers.get("x-next-page")
    if (!next) break
    page = Number(next)
    if (!page) break
  }
  return out
}

export interface GitlabProject {
  id: number
  path_with_namespace: string
}

/** Resolve target projects: the group's projects (incl. subgroups), or the user's projects. */
export async function listProjects(cfg: GitlabConfig): Promise<GitlabProject[]> {
  if (cfg.group) {
    return gitlabPaginate<GitlabProject>(
      cfg,
      `/groups/${encodeURIComponent(cfg.group)}/projects`,
      { include_subgroups: "true", with_shared: "false", archived: "false", order_by: "last_activity_at" },
      5
    )
  }
  return gitlabPaginate<GitlabProject>(cfg, "/projects", { membership: "true", order_by: "last_activity_at" }, 3)
}
