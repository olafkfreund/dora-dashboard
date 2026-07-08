"use client"

import { useActionState, useState } from "react"
import { Send, Mail, Webhook } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/labeled-input"
import { FormMessage } from "@/components/ui/form-message"
import type { DigestChannel, DigestSettings } from "@/lib/digest/types"
import { saveDigestAction, testDigestAction } from "./digest-actions"

export function DigestPanel({
  settings,
  teams,
}: {
  settings: DigestSettings
  teams: { slug: string; name: string }[]
}) {
  const [save, saveAction, saving] = useActionState(saveDigestAction, undefined)
  const [test, testAction, testing] = useActionState(testDigestAction, undefined)
  const [channel, setChannel] = useState<DigestChannel>(settings.channel)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <Send className="size-4" />
          </div>
          <CardTitle className="text-base">
            Scheduled digest{" "}
            <span className="text-xs font-normal text-muted-foreground">· email or Teams/Slack, on a schedule</span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <form action={saveAction} className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="size-4" />
            Enable the scheduled digest
          </label>

          <div className="flex gap-2">
            {(["webhook", "email"] as DigestChannel[]).map((c) => (
              <label
                key={c}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  channel === c ? "border-primary bg-primary/10" : "border-input"
                }`}
              >
                <input
                  type="radio"
                  name="channel"
                  value={c}
                  checked={channel === c}
                  onChange={() => setChannel(c)}
                  className="size-3.5"
                />
                {c === "webhook" ? <Webhook className="size-4" /> : <Mail className="size-4" />}
                {c === "webhook" ? "Teams / Slack webhook" : "Email (SMTP)"}
              </label>
            ))}
          </div>

          {channel === "webhook" ? (
            <Field
              label="Incoming webhook URL"
              name="secret"
              type="password"
              placeholder={settings.hasSecret ? "•••• stored — leave blank to keep" : "https://…/webhook"}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Recipients (comma-separated)" name="to" defaultValue={settings.to} placeholder="lead@company.com, eng@company.com" />
              <Field label="From" name="from" defaultValue={settings.from} placeholder="dora-dashboard@company.com" />
              <Field label="SMTP host" name="smtpHost" defaultValue={settings.smtpHost} placeholder="smtp.internal" />
              <Field label="SMTP port" name="smtpPort" type="number" defaultValue={settings.smtpPort} className="max-w-32" />
              <Field label="SMTP username (optional)" name="smtpUser" defaultValue={settings.smtpUser} placeholder="apikey / user" />
              <Field
                label="SMTP password"
                name="secret"
                type="password"
                placeholder={settings.hasSecret ? "•••• stored — leave blank to keep" : "app password"}
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="secure" defaultChecked={settings.secure} className="size-4" /> Use TLS (port 465)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="includePdf" defaultChecked={settings.includePdf} className="size-4" /> Attach the PDF report
              </label>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="teamSlug" className="text-sm font-medium">
                Scope
              </label>
              <select
                id="teamSlug"
                name="teamSlug"
                defaultValue={settings.teamSlug ?? "all"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="all" className="bg-background text-foreground">
                  All teams (org)
                </option>
                {teams.map((t) => (
                  <option key={t.slug} value={t.slug} className="bg-background text-foreground">
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save digest settings"}
            </Button>
            <div className="flex-1">
              <FormMessage state={save} />
            </div>
          </div>
        </form>

        <form action={testAction} className="flex items-center gap-3 border-t border-border pt-4">
          <Button type="submit" size="sm" variant="outline" disabled={testing}>
            <Send className={testing ? "size-4 animate-spin" : "size-4"} />
            {testing ? "Sending…" : "Send test now"}
          </Button>
          <div className="flex-1">
            {test ? (
              <FormMessage state={test} />
            ) : (
              <span className="text-xs text-muted-foreground">
                Save first, then send a one-off to verify. Scheduling is driven by a CronJob calling <code>/api/digest/run</code>.
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
