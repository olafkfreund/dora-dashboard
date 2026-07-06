// Seed a bootstrap admin user. Idempotent. Run: node scripts/seed.mjs
import postgres from "postgres"
import bcrypt from "bcryptjs"
import { readFileSync } from "node:fs"

// Minimal .env loader (dev only).
try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1")
  }
} catch {}

const url = process.env.DATABASE_URL
const email = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@dora.local"
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "ChangeMe!12345"
if (!url) throw new Error("DATABASE_URL not set")

const sql = postgres(url, { max: 1 })
const passwordHash = await bcrypt.hash(password, 12)

const existing = await sql`SELECT id FROM "user" WHERE email = ${email}`
if (existing.length) {
  await sql`UPDATE "user" SET "passwordHash" = ${passwordHash}, role = 'ADMIN', status = 'ACTIVE' WHERE email = ${email}`
  console.log(`Updated existing admin: ${email}`)
} else {
  await sql`INSERT INTO "user" (id, name, email, "passwordHash", role, status)
            VALUES (${crypto.randomUUID()}, 'Administrator', ${email}, ${passwordHash}, 'ADMIN', 'ACTIVE')`
  console.log(`Created admin: ${email}`)
}
await sql.end()
