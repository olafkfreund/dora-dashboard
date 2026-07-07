import { cn } from "@/lib/utils"

export type BadgeTone = "success" | "error" | "muted"

const TONES: Record<BadgeTone, string> = {
  success: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
  error: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
}

/** Small pill for status/enabled/health indicators. */
export function StatusBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TONES[tone])}>
      {children}
    </span>
  )
}
