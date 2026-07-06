"use client"

import { useActionState } from "react"
import { Gauge, Github, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { loginAction, signInEntra, signInGithubSso } from "./actions"

export function LoginForm({
  sso = { entra: false, github: false },
}: {
  sso?: { entra: boolean; github: boolean }
}) {
  const [error, formAction, pending] = useActionState(loginAction, undefined)
  const hasSso = sso.entra || sso.github

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
        </form>

        {hasSso ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or continue with{" "}
              <span className="h-px flex-1 bg-border" />
            </div>
            {sso.entra && (
              <form action={signInEntra}>
                <Button type="submit" variant="outline" className="w-full">
                  <ShieldCheck className="size-4" /> Sign in with Entra ID
                </Button>
              </form>
            )}
            {sso.github && (
              <form action={signInGithubSso}>
                <Button type="submit" variant="outline" className="w-full">
                  <Github className="size-4" /> Sign in with GitHub
                </Button>
              </form>
            )}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Enterprise SSO (Entra ID / GitHub) can be enabled in Settings.
          </div>
        )}
      </div>
    </div>
  )
}
