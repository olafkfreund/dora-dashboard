"use client"

import { useActionState } from "react"
import { Github, ListChecks, Plug } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { saveGithub, saveJira, testConnection } from "./actions"

type ActionState = { ok?: boolean; message?: string } | undefined

export interface IntegrationView {
  status: "UNCONFIGURED" | "CONNECTED" | "ERROR"
  hasToken: boolean
  config: Record<string, string>
  lastError?: string | null
  lastSyncAt?: string | null
}

function StatusBadge({ status }: { status: IntegrationView["status"] }) {
  const map = {
    CONNECTED: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
    ERROR: "bg-destructive/15 text-destructive",
    UNCONFIGURED: "bg-muted text-muted-foreground",
  } as const
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", map[status])}>
      {status.toLowerCase()}
    </span>
  )
}

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
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
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

export function IntegrationsPanel({
  github,
  jira,
}: {
  github: IntegrationView
  jira: IntegrationView
}) {
  const [ghSave, ghSaveAction, ghSaving] = useActionState(saveGithub, undefined)
  const [ghTest, ghTestAction] = useActionState(testConnection, undefined)
  const [jSave, jSaveAction, jSaving] = useActionState(saveJira, undefined)
  const [jTest, jTestAction] = useActionState(testConnection, undefined)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* GitHub */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <Github className="size-4" />
              </div>
              <CardTitle className="text-base">GitHub</CardTitle>
            </div>
            <StatusBadge status={github.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={ghSaveAction} className="space-y-4">
            <Field label="Organization" name="org" defaultValue={github.config.org} placeholder="my-org" />
            <Field
              label="Access token (PAT / App token)"
              name="token"
              type="password"
              placeholder={github.hasToken ? "•••• stored — leave blank to keep" : "ghp_…"}
            />
            <Msg state={ghSave} />
            <Button type="submit" size="sm" disabled={ghSaving}>
              {ghSaving ? "Saving…" : "Save GitHub"}
            </Button>
          </form>
          <form action={ghTestAction} className="flex items-center gap-3 border-t border-border pt-3">
            <input type="hidden" name="provider" value="GITHUB" />
            <Button type="submit" size="sm" variant="outline">
              <Plug className="size-4" /> Test connection
            </Button>
            <div className="flex-1">
              <Msg state={ghTest} />
            </div>
          </form>
          {github.lastError && !ghTest && (
            <p className="text-xs text-destructive">Last error: {github.lastError}</p>
          )}
        </CardContent>
      </Card>

      {/* Jira */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <ListChecks className="size-4" />
              </div>
              <CardTitle className="text-base">Jira</CardTitle>
            </div>
            <StatusBadge status={jira.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={jSaveAction} className="space-y-4">
            <Field label="Base URL" name="baseUrl" defaultValue={jira.config.baseUrl} placeholder="https://org.atlassian.net" />
            <Field label="Email" name="email" defaultValue={jira.config.email} placeholder="you@company.com" />
            <Field
              label="API token"
              name="token"
              type="password"
              placeholder={jira.hasToken ? "•••• stored — leave blank to keep" : "Atlassian API token"}
            />
            <Msg state={jSave} />
            <Button type="submit" size="sm" disabled={jSaving}>
              {jSaving ? "Saving…" : "Save Jira"}
            </Button>
          </form>
          <form action={jTestAction} className="flex items-center gap-3 border-t border-border pt-3">
            <input type="hidden" name="provider" value="JIRA" />
            <Button type="submit" size="sm" variant="outline">
              <Plug className="size-4" /> Test connection
            </Button>
            <div className="flex-1">
              <Msg state={jTest} />
            </div>
          </form>
          {jira.lastError && !jTest && (
            <p className="text-xs text-destructive">Last error: {jira.lastError}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
