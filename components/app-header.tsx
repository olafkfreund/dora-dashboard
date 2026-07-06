import Link from "next/link"
import { Gauge, LogOut } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { signOutAction } from "@/app/actions/session"

export function AppHeader({
  user,
  active,
}: {
  user: { name?: string | null; email?: string | null; role: "ADMIN" | "LEAD" | "VIEWER" }
  active?: "dashboard" | "settings" | "users"
}) {
  const isAdmin = user.role === "ADMIN"
  const link = (href: string, label: string, key: string) => (
    <Link
      href={href}
      className={
        active === key
          ? "text-sm font-medium text-foreground"
          : "text-sm text-muted-foreground hover:text-foreground"
      }
    >
      {label}
    </Link>
  )

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Gauge className="size-5" />
            </div>
            <span className="hidden text-sm font-semibold sm:inline">DORA Dashboard</span>
          </Link>
          <nav className="flex items-center gap-4">
            {link("/", "Dashboard", "dashboard")}
            {isAdmin && link("/settings", "Settings", "settings")}
            {isAdmin && link("/users", "Users", "users")}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium leading-tight">{user.name ?? user.email}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{user.role}</p>
          </div>
          <ThemeToggle />
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm" aria-label="Sign out">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
