// Intentionally rotate the bootstrap admin password.
// Usage: node scripts/rotate-admin.mjs [newPassword]
// Falls back to BOOTSTRAP_ADMIN_PASSWORD if no arg is given.
import postgres from "postgres"
import bcrypt from "bcryptjs"
import { loadEnv } from "./load-env.mjs"

loadEnv()

const url = process.env.DATABASE_URL
const email = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@dora.local"
const password = process.argv[2] || process.env.BOOTSTRAP_ADMIN_PASSWORD
if (!url) throw new Error("DATABASE_URL not set")
if (!password) throw new Error("No password given (arg or BOOTSTRAP_ADMIN_PASSWORD)")

const sql = postgres(url, { max: 1 })
const passwordHash = await bcrypt.hash(password, 12)
const res = await sql`
  UPDATE "user" SET "passwordHash" = ${passwordHash}, status = 'ACTIVE'
  WHERE email = ${email}`
console.log(res.count ? `Rotated password for ${email}.` : `No user ${email} found.`)
await sql.end()
