"use client"

import { useActionState } from "react"
import { Github, ListChecks, Plug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/labeled-input"
import { FormMessage } from "@/components/ui/form-message"
import { StatusBadge, type BadgeTone } from "@/components/ui/status-badge"
import { saveGithub, saveJira, testConnection } from "./actions"

export interface IntegrationView {
  status: "UNCONFIGURED" | "CONNECTED" | "ERROR"
  hasToken: boolean
  config: Record<string, string>
  lastError?: string | null
}

const STATUS_TONE: Record<IntegrationView["status"], BadgeTone> = {
  CONNECTED: "success",
  ERROR: "error",
  UNCONFIGURED: "muted",
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
            <StatusBadge tone={STATUS_TONE[github.status]}>{github.status.toLowerCase()}</StatusBadge>
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
            <FormMessage state={ghSave} />
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
              <FormMessage state={ghTest} />
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
            <StatusBadge tone={STATUS_TONE[jira.status]}>{jira.status.toLowerCase()}</StatusBadge>
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
            <FormMessage state={jSave} />
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
              <FormMessage state={jTest} />
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
