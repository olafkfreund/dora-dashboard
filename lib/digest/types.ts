// Pure digest types (no DB / no React).
export type DigestChannel = "email" | "webhook"

/** Non-secret digest settings (as shown in the Settings form). */
export interface DigestSettings {
  enabled: boolean
  channel: DigestChannel
  to: string // comma-separated recipients (email)
  from: string
  smtpHost: string
  smtpPort: number
  smtpUser: string
  secure: boolean
  teamSlug: string | null
  includePdf: boolean
  /** Whether a secret (SMTP password / webhook URL) is stored. */
  hasSecret: boolean
}

export const DEFAULT_DIGEST: DigestSettings = {
  enabled: false,
  channel: "webhook",
  to: "",
  from: "dora-dashboard@localhost",
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  secure: false,
  teamSlug: null,
  includePdf: true,
  hasSecret: false,
}
