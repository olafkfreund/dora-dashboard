// Minimal .env loader for the standalone scripts (local dev only).
// In-cluster relies on real environment variables.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

export function loadEnv() {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env")
  try {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1")
    }
  } catch {
    // no .env — fine
  }
}
