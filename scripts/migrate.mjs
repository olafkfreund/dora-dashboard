// Apply db/migrations/*.sql in order, tracked in a _migrations table. Idempotent.
// Run: node scripts/migrate.mjs
import postgres from "postgres"
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadEnv } from "./load-env.mjs"

const __dir = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dir, "..", "db", "migrations")

loadEnv()

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL not set")

const sql = postgres(url, { max: 1 })

// Wait for the database to accept connections (bundled Postgres may still be starting).
for (let i = 1; i <= 30; i++) {
  try {
    await sql`SELECT 1`
    break
  } catch (err) {
    if (i === 30) throw err
    console.log(`waiting for database… (${i}/30)`)
    await new Promise((r) => setTimeout(r, 2000))
  }
}

await sql`CREATE TABLE IF NOT EXISTS _migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)`

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()

const applied = new Set((await sql`SELECT name FROM _migrations`).map((r) => r.name))

let count = 0
for (const file of files) {
  if (applied.has(file)) continue
  const ddl = readFileSync(join(migrationsDir, file), "utf8")
  // drizzle statement-breakpoint markers split statements; run whole file in a tx.
  await sql.begin(async (tx) => {
    await tx.unsafe(ddl)
    await tx`INSERT INTO _migrations (name) VALUES (${file})`
  })
  console.log(`applied ${file}`)
  count++
}

console.log(count ? `Applied ${count} migration(s).` : "No pending migrations.")
await sql.end()
