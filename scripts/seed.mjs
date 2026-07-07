// Seed a bootstrap admin user. Idempotent. Run: node scripts/seed.mjs
import postgres from "postgres"
import bcrypt from "bcryptjs"
import { loadEnv } from "./load-env.mjs"

loadEnv()

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
