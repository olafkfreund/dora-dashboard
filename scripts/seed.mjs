// Seed a bootstrap admin user — CREATE-ONLY. Safe to run on every start:
// if the admin already exists it is left untouched, so an in-app password/role/
// status change is never reverted and the account can be durably disabled.
// To rotate, use scripts/rotate-admin.mjs (updates the password intentionally).
import postgres from "postgres"
import bcrypt from "bcryptjs"
import { loadEnv } from "./load-env.mjs"

loadEnv()

const url = process.env.DATABASE_URL
const email = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@dora.local"
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "ChangeMe!12345"
if (!url) throw new Error("DATABASE_URL not set")

const sql = postgres(url, { max: 1 })

const existing = await sql`SELECT id FROM "user" WHERE email = ${email}`
if (existing.length) {
  console.log(`Admin ${email} already exists — leaving unchanged.`)
} else {
  const passwordHash = await bcrypt.hash(password, 12)
  await sql`INSERT INTO "user" (id, name, email, "passwordHash", role, status)
            VALUES (${crypto.randomUUID()}, 'Administrator', ${email}, ${passwordHash}, 'ADMIN', 'ACTIVE')`
  console.log(`Created admin: ${email}`)
}
await sql.end()
