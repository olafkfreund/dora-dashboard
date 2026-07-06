import { desc } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/db"
import { users } from "@/db/schema"
import { AppHeader } from "@/components/app-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreateUserForm } from "./create-user-form"
import { setRole, toggleStatus } from "./actions"

export const metadata = { title: "Users · DORA Dashboard" }

export default async function UsersPage() {
  const admin = await requireAdmin()
  const all = await db.select().from(users).orderBy(desc(users.createdAt))

  return (
    <div className="min-h-screen">
      <AppHeader user={admin} active="users" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage accounts and roles. Team-level metrics only — no individual
            performance ranking.
          </p>
        </div>

        <Card className="mb-6 p-5">
          <h2 className="mb-3 text-sm font-semibold">Add a user</h2>
          <CreateUserForm />
        </Card>

        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {all.map((u) => (
                <tr key={u.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <form action={setRole} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <select
                        name="role"
                        defaultValue={u.role}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="VIEWER">Viewer</option>
                        <option value="LEAD">Lead</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <Button type="submit" size="sm" variant="ghost">Set</Button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.status === "ACTIVE"
                          ? "rounded-full bg-[color:var(--success)]/15 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--success)]"
                          : "rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                      }
                    >
                      {u.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 16).replace("T", " ") : "never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== admin.id && (
                      <form action={toggleStatus}>
                        <input type="hidden" name="id" value={u.id} />
                        <Button type="submit" size="sm" variant="outline">
                          {u.status === "ACTIVE" ? "Disable" : "Enable"}
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>
    </div>
  )
}
