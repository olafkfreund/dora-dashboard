import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

// postgres.js connects lazily (on first query), so constructing with a
// placeholder when DATABASE_URL is unset lets `next build` evaluate modules
// without a live database. A real DATABASE_URL is required at runtime.
const connectionString =
  process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@127.0.0.1:5432/placeholder"

// Reuse a single client across hot-reloads in dev.
const globalForDb = globalThis as unknown as { _pgClient?: ReturnType<typeof postgres> }
const client = globalForDb._pgClient ?? postgres(connectionString, { max: 5 })
if (process.env.NODE_ENV !== "production") globalForDb._pgClient = client

export const db = drizzle(client, { schema })
export * as tables from "./schema"
