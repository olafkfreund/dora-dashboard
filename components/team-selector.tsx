"use client"

import { useRouter } from "next/navigation"
import { Users } from "lucide-react"

/** Dashboard team filter — navigates to ?team=<slug> (or "/" for all teams). */
export function TeamSelector({
  teams,
  current,
}: {
  teams: { slug: string; name: string }[]
  current?: string
}) {
  const router = useRouter()
  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-2 text-sm">
      <Users className="size-4 text-muted-foreground" />
      <select
        aria-label="Filter by team"
        value={current ?? "all"}
        onChange={(e) => {
          const v = e.target.value
          router.push(v === "all" ? "/" : `/?team=${encodeURIComponent(v)}`)
        }}
        className="bg-background pr-1 text-sm font-medium text-foreground outline-none"
      >
        <option value="all" className="bg-background text-foreground">
          All teams
        </option>
        {teams.map((t) => (
          <option key={t.slug} value={t.slug} className="bg-background text-foreground">
            {t.name}
          </option>
        ))}
      </select>
    </label>
  )
}
