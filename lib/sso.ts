import "server-only"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import GitHub from "next-auth/providers/github"
import type { Provider } from "next-auth/providers"
import { db } from "@/db"
import { ssoProviders } from "@/db/schema"
import { decryptSecret } from "@/lib/crypto"

type SsoRow = typeof ssoProviders.$inferSelect
type SsoConfig = { clientId?: string; tenantId?: string }

/** SSO rows that are enabled, have a stored secret, and a client id. Single source of truth. */
async function readUsableRows(): Promise<SsoRow[]> {
  try {
    const rows = await db.select().from(ssoProviders)
    return rows.filter(
      (r) => r.enabled && r.encryptedSecret && (r.config as SsoConfig)?.clientId
    )
  } catch {
    // DB not ready (e.g. before migrations) — treat as no SSO.
    return []
  }
}

/** Build next-auth provider instances for the usable SSO rows. */
export async function loadSsoProviders(): Promise<Provider[]> {
  const providers: Provider[] = []
  for (const row of await readUsableRows()) {
    const cfg = row.config as SsoConfig
    let secret: string
    try {
      secret = decryptSecret(row.encryptedSecret!)
    } catch {
      continue
    }
    if (row.provider === "ENTRA") {
      providers.push(
        MicrosoftEntraID({
          clientId: cfg.clientId!,
          clientSecret: secret,
          issuer: `https://login.microsoftonline.com/${cfg.tenantId ?? "common"}/v2.0`,
        })
      )
    } else if (row.provider === "GITHUB") {
      providers.push(GitHub({ clientId: cfg.clientId!, clientSecret: secret }))
    }
  }
  return providers
}

/** Which SSO buttons to show on the login page (same predicate as loadSsoProviders). */
export async function enabledSsoProviders(): Promise<{ entra: boolean; github: boolean }> {
  const rows = await readUsableRows()
  return {
    entra: rows.some((r) => r.provider === "ENTRA"),
    github: rows.some((r) => r.provider === "GITHUB"),
  }
}
