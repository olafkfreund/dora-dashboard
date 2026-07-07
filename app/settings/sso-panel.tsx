"use client"

import { useActionState } from "react"
import { Github, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/labeled-input"
import { FormMessage } from "@/components/ui/form-message"
import { StatusBadge } from "@/components/ui/status-badge"
import { saveEntra, saveGithubOauth } from "./sso-actions"

export interface SsoView {
  enabled: boolean
  hasSecret: boolean
  config: { clientId?: string; tenantId?: string }
}

function CallbackUrl({ label, url }: { label: string; url: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <code className="block overflow-x-auto whitespace-nowrap rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs">
        {url}
      </code>
    </div>
  )
}

function EnabledToggle({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name="enabled" defaultChecked={defaultChecked} className="size-4 accent-[color:var(--primary)]" />
      Enable this sign-in method
    </label>
  )
}

export function SsoPanel({
  entra,
  github,
  callbackBase,
}: {
  entra: SsoView
  github?: SsoView
  callbackBase: string
}) {
  const [entraState, entraAction, entraPending] = useActionState(saveEntra, undefined)
  const [ghState, ghAction, ghPending] = useActionState(saveGithubOauth, undefined)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Entra ID */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <ShieldCheck className="size-4" />
              </div>
              <CardTitle className="text-base">Azure Entra ID (SSO)</CardTitle>
            </div>
            <StatusBadge tone={entra.enabled ? "success" : "muted"}>
              {entra.enabled ? "enabled" : "disabled"}
            </StatusBadge>
          </div>
        </CardHeader>
        <CardContent>
          <form action={entraAction} className="space-y-4">
            <Field label="Application (client) ID" name="clientId" defaultValue={entra.config.clientId} placeholder="00000000-0000-0000-0000-000000000000" />
            <Field label="Directory (tenant) ID" name="tenantId" defaultValue={entra.config.tenantId} placeholder="tenant id or 'common'" />
            <Field label="Client secret" name="secret" type="password" placeholder={entra.hasSecret ? "•••• stored — leave blank to keep" : "client secret value"} />
            <CallbackUrl label="Redirect URI (add in Azure → App registration)" url={`${callbackBase}/api/auth/callback/microsoft-entra-id`} />
            <EnabledToggle defaultChecked={entra.enabled} />
            <FormMessage state={entraState} />
            <Button type="submit" size="sm" disabled={entraPending}>
              {entraPending ? "Saving…" : "Save Entra ID"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* GitHub OAuth (hidden unless FEATURE_GITHUB is enabled) */}
      {github && (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <Github className="size-4" />
              </div>
              <CardTitle className="text-base">GitHub OAuth (sign-in)</CardTitle>
            </div>
            <StatusBadge tone={github.enabled ? "success" : "muted"}>
              {github.enabled ? "enabled" : "disabled"}
            </StatusBadge>
          </div>
        </CardHeader>
        <CardContent>
          <form action={ghAction} className="space-y-4">
            <Field label="Client ID" name="clientId" defaultValue={github.config.clientId} placeholder="Iv1.abc123…" />
            <Field label="Client secret" name="secret" type="password" placeholder={github.hasSecret ? "•••• stored — leave blank to keep" : "client secret value"} />
            <CallbackUrl label="Authorization callback URL (add in GitHub → OAuth App)" url={`${callbackBase}/api/auth/callback/github`} />
            <EnabledToggle defaultChecked={github.enabled} />
            <FormMessage state={ghState} />
            <Button type="submit" size="sm" disabled={ghPending}>
              {ghPending ? "Saving…" : "Save GitHub OAuth"}
            </Button>
          </form>
        </CardContent>
      </Card>
      )}
    </div>
  )
}
