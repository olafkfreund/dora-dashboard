"use client"

import { useActionState } from "react"
import { Gauge, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { loginAction } from "./actions"

export function LoginForm() {
  const [error, formAction, pending] = useActionState(loginAction, undefined)

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Gauge className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">DORA Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to your self-hosted portal
            </p>
          </div>
        </div>

        <form
          action={formAction}
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>

          <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Enterprise SSO (Entra ID / GitHub) can be enabled by an administrator.
          </div>
        </form>
      </div>
    </div>
  )
}
