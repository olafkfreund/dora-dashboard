// Wipe ingested delivery data and replace it with deterministic MOCK data for demos.
// Use when the portal must show realistic DORA / flow / quality metrics WITHOUT being
// connected to any real GitLab or Jira (regulated demos, sales, offline).
//
//   node scripts/seed-demo.mjs            # wipe + seed
//   node scripts/seed-demo.mjs --wipe     # wipe only (leave DB empty)
//
// Touches ONLY ingested tables + derived snapshots. Never users, roles, audit_log,
// integration credentials, SSO, teams or metric_config.
import { createRequire } from "module"
import { loadEnv } from "./load-env.mjs"

// Resolve postgres whether run from ./scripts (local/CI) or copied to /tmp (in-pod).
const require = createRequire(import.meta.url)
let postgres
try {
  postgres = require("postgres")
} catch {
  postgres = createRequire("/app/")("postgres")
}

loadEnv()
const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL not set")
const wipeOnly = process.argv.includes("--wipe")
const sql = postgres(url, { ssl: process.env.PGSSL === "disable" ? false : "require", max: 1 })

const DAY = 864e5
const now = Date.now()
const WINDOW_DAYS = 180

// Deterministic PRNG so every demo seed is identical (mulberry32).
let _s = 42
const rnd = () => {
  _s |= 0
  _s = (_s + 0x6d2b79f5) | 0
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (a) => a[Math.floor(rnd() * a.length)]
const between = (lo, hi) => lo + rnd() * (hi - lo)
const daysAgo = (d) => new Date(now - d * DAY)
const hex = (n) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(rnd() * 16)]).join("")

// PI buckets across the window (oldest→newest), matching the customer's PI1..PI5.
const PIS = ["PI1", "PI2", "PI3", "PI4", "PI5"]
const piForCreated = (createdMs) => {
  const frac = (createdMs - (now - WINDOW_DAYS * DAY)) / (WINDOW_DAYS * DAY) // 0..1
  return PIS[Math.min(PIS.length - 1, Math.max(0, Math.floor(frac * PIS.length)))]
}

const PROJECTS = [
  { id: 101, path: "platform/web" },
  { id: 102, path: "platform/api" },
]

// -------- wipe --------
async function wipe() {
  await sql`TRUNCATE
    gitlab_deployment, gitlab_incident, gitlab_merge_request, gitlab_coverage,
    jira_issue, jira_transition, jira_sprint, metric_snapshot, sync_state`
  console.log("Wiped ingested tables + snapshots.")
}

// -------- generators --------
function genGitlab() {
  const deployments = [], incidents = [], mrs = [], coverage = []
  for (const p of PROJECTS) {
    let depId = 1000, iid = 1
    for (let d = WINDOW_DAYS; d >= 0; d--) {
      const day = daysAgo(d)
      if (day.getDay() === 0 || day.getDay() === 6) continue // weekdays
      if (rnd() > 0.8) continue
      const failed = rnd() < 0.06
      const created = new Date(day.getTime() + between(9, 18) * 3600e3)
      deployments.push({
        id: `${p.id}:${depId}`, projectId: p.id, deploymentId: depId++,
        projectPath: p.path, environment: "production",
        status: failed ? "failed" : "success", ref: "main", sha: hex(40),
        createdAt: created, finishedAt: new Date(created.getTime() + between(2, 20) * 60e3),
        committedAt: new Date(created.getTime() - between(0.5, 5) * DAY),
      })
    }
    // merge requests
    for (let n = 0; n < 125; n++) {
      const first = daysAgo(between(1, WINDOW_DAYS))
      const merged = new Date(first.getTime() + between(0.5, 8) * DAY)
      mrs.push({
        id: `${p.id}:${iid}`, projectId: p.id, iid: iid++, projectPath: p.path,
        createdAt: new Date(first.getTime() + between(0.1, 1) * DAY), mergedAt: merged,
        mergeCommitSha: hex(40), firstCommitAt: first,
        firstReviewAt: new Date(first.getTime() + between(0.2, 3) * DAY),
      })
    }
    // incidents
    for (let n = 0; n < 9; n++) {
      const created = daysAgo(between(1, WINDOW_DAYS))
      const open = rnd() < 0.1
      incidents.push({
        id: `${p.id}:900${n}`, projectId: p.id, iid: 9000 + n, projectPath: p.path,
        state: open ? "opened" : "closed", createdAt: created,
        closedAt: open ? null : new Date(created.getTime() + between(1, 72) * 3600e3),
      })
    }
    coverage.push({ projectId: p.id, projectPath: p.path, coverage: Math.round(between(72, 86) * 10) / 10, ref: "main" })
  }
  return { deployments, incidents, mrs, coverage }
}

function genJira() {
  const sprints = [], issues = [], transitions = []
  // 6 fortnightly sprints inside the window
  for (let i = 0; i < 6; i++) {
    const start = daysAgo(WINDOW_DAYS - i * 28)
    const end = new Date(start.getTime() + 28 * DAY)
    sprints.push({
      id: 500 + i, boardId: 1, name: `Sprint ${i + 1}`,
      state: i < 5 ? "closed" : "active", startDate: start, endDate: end,
      completeDate: i < 5 ? end : null,
    })
  }
  const TYPES = [
    ...Array(55).fill("Story"), ...Array(20).fill("Bug"),
    ...Array(15).fill("Task"), ...Array(6).fill("Feature"), ...Array(4).fill("Incident"),
  ]
  const ROOT = ["Requirements", "Design", "Coding", "Testing", "Environment", "Data"]
  const ENV = [...Array(6).fill("Production"), ...Array(3).fill("Pre-Prod"), ...Array(4).fill("Non-Prod")]
  const LABELS = ["feature", "ktlo", "tech-debt", "support"]
  const SP = [1, 2, 3, 5, 8, 13]

  let key = 1000
  const featureKeys = []
  const N = 1500
  for (let i = 0; i < N; i++) {
    const id = `DEMO-${key++}`
    const type = pick(TYPES)
    const created = daysAgo(between(1, WINDOW_DAYS))
    const roll = rnd()
    const category = roll < 0.78 ? "Done" : roll < 0.92 ? "In Progress" : "To Do"
    const status = category === "Done" ? "Done" : category === "In Progress" ? "In Progress" : "To Do"

    const inProgressAt = category === "To Do" ? null : new Date(created.getTime() + between(0.5, 10) * DAY)
    // created → resolved lands ~15-40d so demo medians resemble real PIs
    const resolvedAt = category === "Done" ? new Date(created.getTime() + between(12, 42) * DAY) : null
    const updatedAt = resolvedAt || inProgressAt || created

    // PI membership: primary from created bucket, ~15% span a second PI
    const pi = piForCreated(created.getTime())
    const pis = [pi]
    if (rnd() < 0.15) {
      const j = PIS.indexOf(pi)
      const other = PIS[Math.min(PIS.length - 1, j + 1)]
      if (other !== pi) pis.push(other)
    }

    const isDefect = type === "Bug" || type === "Incident"
    const blocked = rnd() < 0.2 ? Math.floor(between(1, 10) * DAY / 1000) : null
    const parentKey = type !== "Feature" && featureKeys.length && rnd() < 0.6 ? pick(featureKeys) : null
    if (type === "Feature") featureKeys.push(id)

    issues.push({
      id, projectKey: "DEMO", summary: `${type} ${id}`, issueType: type,
      status, statusCategory: category,
      storyPoints: type === "Story" || type === "Feature" ? pick(SP) : rnd() < 0.3 ? pick(SP) : null,
      sprintId: 500 + Math.min(5, Math.floor((created.getTime() - (now - WINDOW_DAYS * DAY)) / (28 * DAY))),
      programIncrement: pis,
      parentKey,
      rootCause: isDefect && category === "Done" ? pick(ROOT) : null,
      defectEnv: isDefect ? pick(ENV) : null,
      createdAt: created, updatedAt, inProgressAt, resolvedAt,
      blockedSeconds: blocked,
      labels: sql.json(rnd() < 0.7 ? [pick(LABELS)] : []),
    })

    // transitions: To Do -> In Progress [-> Blocked -> In Progress] -> Done
    let t = 0
    if (inProgressAt) transitions.push({ id: `${id}:${t++}`, issueKey: id, fromStatus: "To Do", toStatus: "In Progress", at: inProgressAt })
    if (blocked && inProgressAt) {
      const bStart = new Date(inProgressAt.getTime() + between(0.5, 3) * DAY)
      transitions.push({ id: `${id}:${t++}`, issueKey: id, fromStatus: "In Progress", toStatus: "Blocked", at: bStart })
      transitions.push({ id: `${id}:${t++}`, issueKey: id, fromStatus: "Blocked", toStatus: "In Progress", at: new Date(bStart.getTime() + blocked * 1000) })
    }
    if (resolvedAt) transitions.push({ id: `${id}:${t++}`, issueKey: id, fromStatus: "In Progress", toStatus: "Done", at: resolvedAt })
  }
  return { sprints, issues, transitions }
}

async function insertChunked(table, rows, cols) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    await sql`insert into ${sql(table)} ${sql(chunk, ...cols)}`
  }
  console.log(`  ${table}: ${rows.length}`)
}

// -------- run --------
await wipe()
if (!wipeOnly) {
  const gl = genGitlab()
  const jira = genJira()
  console.log("Seeding mock data:")
  await insertChunked("gitlab_deployment", gl.deployments, ["id", "projectId", "deploymentId", "projectPath", "environment", "status", "ref", "sha", "createdAt", "finishedAt", "committedAt"])
  await insertChunked("gitlab_merge_request", gl.mrs, ["id", "projectId", "iid", "projectPath", "createdAt", "mergedAt", "mergeCommitSha", "firstCommitAt", "firstReviewAt"])
  await insertChunked("gitlab_incident", gl.incidents, ["id", "projectId", "iid", "projectPath", "state", "createdAt", "closedAt"])
  await insertChunked("gitlab_coverage", gl.coverage, ["projectId", "projectPath", "coverage", "ref"])
  await insertChunked("jira_sprint", jira.sprints, ["id", "boardId", "name", "state", "startDate", "endDate", "completeDate"])
  await insertChunked("jira_issue", jira.issues, ["id", "projectKey", "summary", "issueType", "status", "statusCategory", "storyPoints", "sprintId", "programIncrement", "parentKey", "rootCause", "defectEnv", "createdAt", "updatedAt", "inProgressAt", "resolvedAt", "blockedSeconds", "labels"])
  await insertChunked("jira_transition", jira.transitions, ["id", "issueKey", "fromStatus", "toStatus", "at"])
  console.log("Done. Mock data seeded — not connected to any real system.")
}
await sql.end()
