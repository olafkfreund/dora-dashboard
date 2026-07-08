import "server-only"
import nodemailer from "nodemailer"
import { buildReport } from "@/lib/report/report-data"
import { renderReportPdf } from "@/lib/report/report-document"
import { resolveTeamFilter } from "@/lib/teams/store"
import { getDigestForSend } from "./store"
import { digestText, digestHtml } from "./summary"

export interface DigestResult {
  ok: boolean
  message: string
}

/** Build the delivery report and send it via the configured channel (email or webhook). */
export async function sendDigest(opts?: { test?: boolean }): Promise<DigestResult> {
  const { settings, secret } = await getDigestForSend()
  if (!settings.enabled && !opts?.test) return { ok: false, message: "Digest is disabled." }

  const filter = await resolveTeamFilter(settings.teamSlug)
  const report = await buildReport(new Date(), filter)
  const text = digestText(report)
  const date = report.generatedAt.toISOString().slice(0, 10)

  if (settings.channel === "webhook") {
    if (!secret) return { ok: false, message: "No webhook URL configured." }
    try {
      const res = await fetch(secret, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) return { ok: false, message: `Webhook returned ${res.status} ${res.statusText}` }
      return { ok: true, message: "Digest posted to the webhook." }
    } catch (e) {
      return { ok: false, message: `Webhook failed: ${e instanceof Error ? e.message : "error"}` }
    }
  }

  // Email via SMTP.
  if (!settings.smtpHost || !settings.to) return { ok: false, message: "SMTP host and recipients are required." }
  try {
    const transport = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.secure,
      auth: settings.smtpUser ? { user: settings.smtpUser, pass: secret ?? "" } : undefined,
    })
    const attachments = settings.includePdf
      ? [{ filename: `dora-report-${date}.pdf`, content: await renderReportPdf(report) }]
      : []
    await transport.sendMail({
      from: settings.from,
      to: settings.to,
      subject: `DORA delivery digest${report.teamName ? ` — ${report.teamName}` : ""} — ${date}`,
      text,
      html: digestHtml(report),
      attachments,
    })
    return { ok: true, message: `Emailed digest to ${settings.to}.` }
  } catch (e) {
    return { ok: false, message: `Email failed: ${e instanceof Error ? e.message : "error"}` }
  }
}
