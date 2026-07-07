"use client"

import { useActionState } from "react"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormMessage } from "@/components/ui/form-message"
import { inputCls } from "@/lib/ui"
import { createUser } from "./actions"

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, undefined)
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <div className="space-y-1.5">
        <label htmlFor="name" className="text-xs font-medium">Name</label>
        <input id="name" name="name" required placeholder="Jane Doe" className={inputCls} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-xs font-medium">Email</label>
        <input id="email" name="email" type="email" required placeholder="jane@company.com" className={inputCls} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-xs font-medium">Temp password</label>
        <input id="password" name="password" type="password" required minLength={8} placeholder="min 8 chars" className={inputCls} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="role" className="text-xs font-medium">Role</label>
        <select id="role" name="role" defaultValue="VIEWER" className={inputCls}>
          <option value="VIEWER">Viewer</option>
          <option value="LEAD">Lead</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        <UserPlus className="size-4" /> {pending ? "Creating…" : "Add user"}
      </Button>
      <FormMessage state={state} className="sm:col-span-2 lg:col-span-5" />
    </form>
  )
}
