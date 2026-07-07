import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  pgEnum,
  jsonb,
  boolean,
  doublePrecision,
} from "drizzle-orm/pg-core"

export const roleEnum = pgEnum("role", ["ADMIN", "LEAD", "VIEWER"])
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "DISABLED"])
export const integrationProviderEnum = pgEnum("integration_provider", [
  "GITHUB",
  "GITLAB",
  "JIRA",
])
export const integrationStatusEnum = pgEnum("integration_status", [
  "UNCONFIGURED",
  "CONNECTED",
  "ERROR",
])

// --- Auth.js core tables (shape required by @auth/drizzle-adapter) ---
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // Local-auth + RBAC extensions
  passwordHash: text("passwordHash"),
  role: roleEnum("role").notNull().default("VIEWER"),
  status: userStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  lastLoginAt: timestamp("lastLoginAt", { mode: "date" }),
  // Brute-force protection (account lockout).
  failedLoginAttempts: integer("failedLoginAttempts").notNull().default(0),
  lockedUntil: timestamp("lockedUntil", { mode: "date" }),
})

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
)

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
)

// --- Integrations (GitHub / Jira). Secret stored encrypted (AES-256-GCM). ---
export const integrations = pgTable("integration", {
  provider: integrationProviderEnum("provider").primaryKey(),
  status: integrationStatusEnum("status").notNull().default("UNCONFIGURED"),
  config: jsonb("config").notNull().default({}),
  encryptedToken: text("encryptedToken"),
  lastSyncAt: timestamp("lastSyncAt", { mode: "date" }),
  lastError: text("lastError"),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  updatedById: text("updatedById"),
})

// --- SSO providers (Entra ID / GitHub OAuth). Client secret encrypted at rest. ---
export const ssoProviderEnum = pgEnum("sso_provider_type", ["ENTRA", "GITHUB"])

export const ssoProviders = pgTable("sso_provider", {
  provider: ssoProviderEnum("provider").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  // Non-secret config: { clientId, tenantId? }
  config: jsonb("config").notNull().default({}),
  encryptedSecret: text("encryptedSecret"),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  updatedById: text("updatedById"),
})

// --- Ingested delivery data (GitLab). Raw events for DORA computation. ---
export const gitlabDeployments = pgTable("gitlab_deployment", {
  // `${projectId}:${deploymentId}`
  id: text("id").primaryKey(),
  projectId: integer("projectId").notNull(),
  deploymentId: integer("deploymentId").notNull(),
  projectPath: text("projectPath"),
  environment: text("environment"),
  status: text("status"), // success | failed | canceled | running | blocked
  ref: text("ref"),
  sha: text("sha"),
  createdAt: timestamp("createdAt", { mode: "date" }),
  finishedAt: timestamp("finishedAt", { mode: "date" }),
  // Authored date of the deployed commit — for Lead Time for Changes.
  committedAt: timestamp("committedAt", { mode: "date" }),
  ingestedAt: timestamp("ingestedAt", { mode: "date" }).notNull().defaultNow(),
})

export const gitlabMergeRequests = pgTable("gitlab_merge_request", {
  // `${projectId}:${iid}`
  id: text("id").primaryKey(),
  projectId: integer("projectId").notNull(),
  iid: integer("iid").notNull(),
  projectPath: text("projectPath"),
  createdAt: timestamp("createdAt", { mode: "date" }),
  mergedAt: timestamp("mergedAt", { mode: "date" }),
  ingestedAt: timestamp("ingestedAt", { mode: "date" }).notNull().defaultNow(),
})

// Per-provider/entity incremental-sync bookkeeping.
// Latest CI test coverage per project — for Test Automation Coverage.
export const gitlabCoverage = pgTable("gitlab_coverage", {
  projectId: integer("projectId").primaryKey(),
  projectPath: text("projectPath"),
  coverage: doublePrecision("coverage"),
  ref: text("ref"),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
})

// --- Jira ingestion (scaffold for Flow / Velocity / Quality metrics) ---
export const jiraIssues = pgTable("jira_issue", {
  // Jira issue key, e.g. "PROJ-123"
  id: text("id").primaryKey(),
  projectKey: text("projectKey"),
  issueType: text("issueType"), // Story | Bug | Task | Incident | ...
  status: text("status"),
  statusCategory: text("statusCategory"), // "To Do" | "In Progress" | "Done"
  storyPoints: doublePrecision("storyPoints"),
  sprintId: integer("sprintId"),
  createdAt: timestamp("createdAt", { mode: "date" }),
  updatedAt: timestamp("updatedAt", { mode: "date" }),
  // First transition into an "In Progress" status — for Cycle Time / Work Item Age.
  inProgressAt: timestamp("inProgressAt", { mode: "date" }),
  resolvedAt: timestamp("resolvedAt", { mode: "date" }),
  // Total time (seconds) spent in a blocked status — for Blocked Time.
  blockedSeconds: integer("blockedSeconds"),
  labels: jsonb("labels"),
  ingestedAt: timestamp("ingestedAt", { mode: "date" }).notNull().defaultNow(),
})
export const jiraTransitions = pgTable("jira_transition", {
  // `${issueKey}:${index}`
  id: text("id").primaryKey(),
  issueKey: text("issueKey").notNull(),
  fromStatus: text("fromStatus"),
  toStatus: text("toStatus"),
  at: timestamp("at", { mode: "date" }),
  ingestedAt: timestamp("ingestedAt", { mode: "date" }).notNull().defaultNow(),
})
export const jiraSprints = pgTable("jira_sprint", {
  id: integer("id").primaryKey(),
  boardId: integer("boardId"),
  name: text("name"),
  state: text("state"), // active | closed | future
  startDate: timestamp("startDate", { mode: "date" }),
  endDate: timestamp("endDate", { mode: "date" }),
  completeDate: timestamp("completeDate", { mode: "date" }),
  ingestedAt: timestamp("ingestedAt", { mode: "date" }).notNull().defaultNow(),
})

export const syncState = pgTable("sync_state", {
  // `${provider}:${entity}`
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  entity: text("entity").notNull(),
  cursor: text("cursor"), // last processed updated_at (ISO)
  lastSyncAt: timestamp("lastSyncAt", { mode: "date" }),
  lastError: text("lastError"),
  itemCount: integer("itemCount").notNull().default(0),
})

// --- Audit log ---
// actorId is intentionally NOT a foreign key: an audit trail must retain the
// acting user's id even if that user is later removed (append-only / tamper-evident).
export const auditLogs = pgTable("audit_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  actorId: text("actorId"),
  action: text("action").notNull(),
  target: text("target"),
  meta: jsonb("meta").notNull().default({}),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
})
