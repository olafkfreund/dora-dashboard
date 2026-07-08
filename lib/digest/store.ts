import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { digestConfig } from "@/db/schema"
import { encryptSecret, decryptSecret } from "@/lib/crypto"
import { DEFAULT_DIGEST, type DigestChannel, type DigestSettings } from "./types"

const ROW = "default"

type StoredConfig = Partial<Omit<DigestSettings, "enabled" | "channel" | "hasSecret">>

function toSettings(row: {
  enabled: boolean
  channel: string
  config: unknown
  encryptedSecret: string | null
}): DigestSettings {
  const c = (row.config ?? {}) as StoredConfig
  return {
    enabled: row.enabled,
    channel: (row.channel === "email" ? "email" : "webhook") as DigestChannel,
    to: c.to ?? DEFAULT_DIGEST.to,
    from: c.from ?? DEFAULT_DIGEST.from,
    smtpHost: c.smtpHost ?? DEFAULT_DIGEST.smtpHost,
    smtpPort: c.smtpPort ?? DEFAULT_DIGEST.smtpPort,
    smtpUser: c.smtpUser ?? DEFAULT_DIGEST.smtpUser,
    secure: c.secure ?? DEFAULT_DIGEST.secure,
    teamSlug: c.teamSlug ?? null,
    includePdf: c.includePdf ?? DEFAULT_DIGEST.includePdf,
    hasSecret: Boolean(row.encryptedSecret),
  }
}

/** Digest settings for display (no secret value). */
export async function getDigestSettings(): Promise<DigestSettings> {
  const rows = await db.select().from(digestConfig).where(eq(digestConfig.id, ROW)).limit(1)
  return rows[0] ? toSettings(rows[0]) : { ...DEFAULT_DIGEST }
}

/** Settings + the decrypted secret — for sending. */
export async function getDigestForSend(): Promise<{ settings: DigestSettings; secret: string | null }> {
  const rows = await db.select().from(digestConfig).where(eq(digestConfig.id, ROW)).limit(1)
  const row = rows[0]
  if (!row) return { settings: { ...DEFAULT_DIGEST }, secret: null }
  let secret: string | null = null
  if (row.encryptedSecret) {
    try {
      secret = decryptSecret(row.encryptedSecret)
    } catch {
      secret = null
    }
  }
  return { settings: toSettings(row), secret }
}

/** Upsert the digest config. A new `secret` (SMTP password / webhook URL) is encrypted; blank keeps the existing one. */
export async function saveDigestConfig(
  input: Omit<DigestSettings, "hasSecret">,
  secret: string | undefined,
  updatedById?: string
): Promise<void> {
  const now = new Date()
  const config: StoredConfig = {
    to: input.to,
    from: input.from,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpUser: input.smtpUser,
    secure: input.secure,
    teamSlug: input.teamSlug,
    includePdf: input.includePdf,
  }
  const enc = secret ? encryptSecret(secret) : undefined
  await db
    .insert(digestConfig)
    .values({ id: ROW, enabled: input.enabled, channel: input.channel, config, encryptedSecret: enc ?? null, updatedById, updatedAt: now })
    .onConflictDoUpdate({
      target: digestConfig.id,
      // Only overwrite the secret when a new one is supplied.
      set: enc
        ? { enabled: input.enabled, channel: input.channel, config, encryptedSecret: enc, updatedById, updatedAt: now }
        : { enabled: input.enabled, channel: input.channel, config, updatedById, updatedAt: now },
    })
}
