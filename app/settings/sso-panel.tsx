"use client"

import { useActionState } from "react"
import { Github, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { saveEntra, saveGithubOauth } from "./sso-actions"

type ActionState = { ok?: boolean; message?: string } | undefined

export interface SsoView {
  enabled: boolean
  hasSecret: boolean
  config: { clientId?: string; tenantId?: string }
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">{label}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} autoComplete="off" className={inputCls} />
    </div>
  )
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

function Msg({ state }: { state: ActionState }) {
  if (!state?.message) return null
  return (
    <p
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        state.ok
          ? "border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[color:var(--success)]"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      {state.message}
    </p>
  )
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        enabled ? "bg-[color:var(--success)]/15 text-[color:var(--success)]" : "bg-muted text-muted-foreground"
      )}
    >
      {enabled ? "enabled" : "disabled"}
    </span>
  )
}

export function SsoPanel({
  entra,
  github,
  callbackBase,
}: {
  entra: SsoView
  github: SsoView
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
            <StatusBadge enabled={entra.enabled} />
          </div>
        </CardHeader>
        <CardContent>
          <form action={entraAction} className="space-y-4">
            <Field label="Application (client) ID" name="clientId" defaultValue={entra.config.clientId} placeholder="00000000-0000-0000-0000-000000000000" />
            <Field label="Directory (tenant) ID" name="tenantId" defaultValue={entra.config.tenantId} placeholder="tenant id or 'common'" />
            <Field label="Client secret" name="secret" type="password" placeholder={entra.hasSecret ? "•••• stored — leave blank to keep" : "client secret value"} />
            <CallbackUrl label="Redirect URI (add in Azure → App registration)" url={`${callbackBase}/api/auth/callback/microsoft-entra-id`} />
            <EnabledToggle defaultChecked={entra.enabled} />
            <Msg state={entraState} />
            <Button type="submit" size="sm" disabled={entraPending}>
              {entraPending ? "Saving…" : "Save Entra ID"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* GitHub OAuth */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <Github className="size-4" />
              </div>
              <CardTitle className="text-base">GitHub OAuth (sign-in)</CardTitle>
            </div>
            <StatusBadge enabled={github.enabled} />
          </div>
        </CardHeader>
        <CardContent>
          <form action={ghAction} className="space-y-4">
            <Field label="Client ID" name="clientId" defaultValue={github.config.clientId} placeholder="Iv1.abc123…" />
            <Field label="Client secret" name="secret" type="password" placeholder={github.hasSecret ? "•••• stored — leave blank to keep" : "client secret value"} />
            <CallbackUrl label="Authorization callback URL (add in GitHub → OAuth App)" url={`${callbackBase}/api/auth/callback/github`} />
            <EnabledToggle defaultChecked={github.enabled} />
            <Msg state={ghState} />
            <Button type="submit" size="sm" disabled={ghPending}>
              {ghPending ? "Saving…" : "Save GitHub OAuth"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
