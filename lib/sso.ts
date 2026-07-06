import "server-only"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import GitHub from "next-auth/providers/github"
import type { Provider } from "next-auth/providers"
import { db } from "@/db"
import { ssoProviders } from "@/db/schema"
import { decryptSecret } from "@/lib/crypto"

type SsoConfig = { clientId?: string; tenantId?: string }

/** Build next-auth provider instances for the SSO rows that are enabled + configured. */
export async function loadSsoProviders(): Promise<Provider[]> {
  let rows: (typeof ssoProviders.$inferSelect)[]
  try {
    rows = await db.select().from(ssoProviders)
  } catch {
    // DB not ready (e.g. before migrations) — no SSO providers.
    return []
  }

  const providers: Provider[] = []
  for (const row of rows) {
    if (!row.enabled || !row.encryptedSecret) continue
    const cfg = (row.config ?? {}) as SsoConfig
    if (!cfg.clientId) continue
    let secret: string
    try {
      secret = decryptSecret(row.encryptedSecret)
    } catch {
      continue
    }
    if (row.provider === "ENTRA") {
      providers.push(
        MicrosoftEntraID({
          clientId: cfg.clientId,
          clientSecret: secret,
          issuer: `https://login.microsoftonline.com/${cfg.tenantId ?? "common"}/v2.0`,
        })
      )
    } else if (row.provider === "GITHUB") {
      providers.push(GitHub({ clientId: cfg.clientId, clientSecret: secret }))
    }
  }
  return providers
}

/** Which SSO buttons to show on the login page. */
export async function enabledSsoProviders(): Promise<{ entra: boolean; github: boolean }> {
  try {
    const rows = await db.select().from(ssoProviders)
    const isReady = (p: "ENTRA" | "GITHUB") =>
      rows.some((r) => r.provider === p && r.enabled && r.encryptedSecret)
    return { entra: isReady("ENTRA"), github: isReady("GITHUB") }
  } catch {
    return { entra: false, github: false }
  }
}
