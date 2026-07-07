import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

// postgres.js connects lazily (on first query), so a placeholder DSN lets
// `next build` evaluate modules without a live database. In a production
// runtime we still require a real DATABASE_URL — fail fast rather than silently
// dialing a bogus localhost DSN.
function resolveConnectionString(): string {
  const url = process.env.DATABASE_URL
  if (url) return url
  const isBuild = process.env.NEXT_PHASE === "phase-production-build"
  if (process.env.NODE_ENV === "production" && !isBuild) {
    throw new Error("DATABASE_URL is not set")
  }
  return "postgres://placeholder:placeholder@127.0.0.1:5432/placeholder"
}
const connectionString = resolveConnectionString()

// Reuse a single client across hot-reloads in dev.
const globalForDb = globalThis as unknown as { _pgClient?: ReturnType<typeof postgres> }
const client = globalForDb._pgClient ?? postgres(connectionString, { max: 5 })
if (process.env.NODE_ENV !== "production") globalForDb._pgClient = client

export const db = drizzle(client, { schema })
export * as tables from "./schema"
