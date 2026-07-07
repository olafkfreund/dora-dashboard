"use client"

import { useActionState } from "react"
import { Github, Gitlab, ListChecks, Plug, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/labeled-input"
import { FormMessage } from "@/components/ui/form-message"
import { StatusBadge, type BadgeTone } from "@/components/ui/status-badge"
import { saveGithub, saveGitlab, saveJira, testConnection } from "./actions"
import { syncGitlabAction } from "./gitlab-actions"

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

function TestForm({
  provider,
  state,
  action,
}: {
  provider: string
  state: { ok?: boolean; message?: string } | undefined
  action: (payload: FormData) => void
}) {
  return (
    <form action={action} className="flex items-center gap-3 border-t border-border pt-3">
      <input type="hidden" name="provider" value={provider} />
      <Button type="submit" size="sm" variant="outline">
        <Plug className="size-4" /> Test connection
      </Button>
      <div className="flex-1">
        <FormMessage state={state} />
      </div>
    </form>
  )
}

export function IntegrationsPanel({
  gitlab,
  github,
  jira,
  gitlabLastSync,
}: {
  gitlab: IntegrationView
  github: IntegrationView
  jira: IntegrationView
  gitlabLastSync?: string | null
}) {
  const [glSave, glSaveAction, glSaving] = useActionState(saveGitlab, undefined)
  const [glTest, glTestAction] = useActionState(testConnection, undefined)
  const [glSync, glSyncAction, glSyncing] = useActionState(syncGitlabAction, undefined)
  const [ghSave, ghSaveAction, ghSaving] = useActionState(saveGithub, undefined)
  const [ghTest, ghTestAction] = useActionState(testConnection, undefined)
  const [jSave, jSaveAction, jSaving] = useActionState(saveJira, undefined)
  const [jTest, jTestAction] = useActionState(testConnection, undefined)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* GitLab — primary DORA metrics source */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <Gitlab className="size-4" />
              </div>
              <CardTitle className="text-base">
                GitLab <span className="text-xs font-normal text-muted-foreground">· primary DORA source</span>
              </CardTitle>
            </div>
            <StatusBadge tone={STATUS_TONE[gitlab.status]}>{gitlab.status.toLowerCase()}</StatusBadge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={glSaveAction} className="space-y-4">
            <Field label="Base URL" name="baseUrl" defaultValue={gitlab.config.baseUrl} placeholder="https://gitlab.com (or self-managed URL)" />
            <Field label="Group or project path" name="group" defaultValue={gitlab.config.group} placeholder="e.g. my-group  or  my-group/my-project" />
            <Field label="Production environment name" name="prodEnv" defaultValue={gitlab.config.prodEnv} placeholder="production" />
            <Field
              label="Access token (PAT — needs read_api scope)"
              name="token"
              type="password"
              placeholder={gitlab.hasToken ? "•••• stored — leave blank to keep" : "glpat-…"}
            />
            <FormMessage state={glSave} />
            <Button type="submit" size="sm" disabled={glSaving}>
              {glSaving ? "Saving…" : "Save GitLab"}
            </Button>
          </form>
          <TestForm provider="GITLAB" state={glTest} action={glTestAction} />
          <form action={glSyncAction} className="flex items-center gap-3 border-t border-border pt-3">
            <Button type="submit" size="sm" variant="outline" disabled={glSyncing}>
              <RefreshCw className={glSyncing ? "size-4 animate-spin" : "size-4"} />
              {glSyncing ? "Syncing…" : "Sync now"}
            </Button>
            <div className="flex-1">
              {glSync ? (
                <FormMessage state={glSync} />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {gitlabLastSync ? `Last sync: ${gitlabLastSync}` : "Never synced — pulls deployments to compute DORA."}
                </span>
              )}
            </div>
          </form>
          {gitlab.lastError && !glTest && !glSync && (
            <p className="text-xs text-destructive">Last error: {gitlab.lastError}</p>
          )}
        </CardContent>
      </Card>

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
          <TestForm provider="GITHUB" state={ghTest} action={ghTestAction} />
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
          <TestForm provider="JIRA" state={jTest} action={jTestAction} />
          {jira.lastError && !jTest && (
            <p className="text-xs text-destructive">Last error: {jira.lastError}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
