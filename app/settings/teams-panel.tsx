"use client"

import { useActionState, useState } from "react"
import { Users, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/labeled-input"
import { FormMessage } from "@/components/ui/form-message"
import type { TeamRecord } from "@/lib/teams/types"
import { saveTeamAction, deleteTeamAction } from "./teams-actions"

function CheckList({
  name,
  options,
  selected,
  empty,
}: {
  name: string
  options: string[]
  selected: string[]
  empty: string
}) {
  if (!options.length) return <p className="text-xs text-muted-foreground">{empty}</p>
  return (
    <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
      {options.map((o) => (
        <label key={o} className="flex items-center gap-2 text-xs">
          <input type="checkbox" name={name} value={o} defaultChecked={selected.includes(o)} className="size-3.5" />
          <span className="font-mono">{o}</span>
        </label>
      ))}
    </div>
  )
}

export function TeamsPanel({
  teams,
  available,
}: {
  teams: TeamRecord[]
  available: { gitlabProjects: string[]; jiraProjectKeys: string[] }
}) {
  const [save, saveAction, saving] = useActionState(saveTeamAction, undefined)
  const [del, delAction] = useActionState(deleteTeamAction, undefined)
  const [editing, setEditing] = useState<TeamRecord | null>(null)
  const formKey = editing?.slug ?? "new"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <Users className="size-4" />
          </div>
          <CardTitle className="text-base">
            Teams <span className="text-xs font-normal text-muted-foreground">· map squads to GitLab projects &amp; Jira keys</span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          {teams.length === 0 && (
            <p className="text-sm text-muted-foreground">No teams yet — create one below to filter the dashboard by squad.</p>
          )}
          {teams.map((t) => (
            <div key={t.slug} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.config.gitlabProjects.length} GitLab · {t.config.jiraProjectKeys.length} Jira keys · <code>{t.slug}</code>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                  Edit
                </Button>
                <form action={delAction}>
                  <input type="hidden" name="slug" value={t.slug} />
                  <Button size="sm" variant="outline" type="submit" aria-label={`Delete ${t.name}`}>
                    <Trash2 className="size-4" />
                  </Button>
                </form>
              </div>
            </div>
          ))}
          <FormMessage state={del} />
        </div>

        <form key={formKey} action={saveAction} className="space-y-4 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">{editing ? `Edit “${editing.name}”` : "Add a team"}</h3>
          {editing && <input type="hidden" name="slug" value={editing.slug} />}
          <Field label="Team name" name="name" defaultValue={editing?.name} placeholder="Payments Squad" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium">GitLab projects</p>
              <CheckList
                name="gitlabProjects"
                options={available.gitlabProjects}
                selected={editing?.config.gitlabProjects ?? []}
                empty="No GitLab projects ingested yet."
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Jira project keys</p>
              <CheckList
                name="jiraProjectKeys"
                options={available.jiraProjectKeys}
                selected={editing?.config.jiraProjectKeys ?? []}
                empty="No Jira issues ingested yet."
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : editing ? "Update team" : "Create team"}
            </Button>
            {editing && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            )}
            <div className="flex-1">
              <FormMessage state={save} />
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
