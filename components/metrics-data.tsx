"use client"

import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { isGood, type Trend } from "@/lib/metrics/catalog"

// Re-export the pure catalog (data + types) so existing imports keep working.
export * from "@/lib/metrics/catalog"

export function TrendBadge({
  trend,
  good,
  showText = false,
}: {
  trend: Trend
  good: "up" | "down"
  showText?: boolean
}) {
  if (trend === "flat") {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const good_ = isGood(trend, good)
  const Icon = trend === "up" ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        good_ ? "text-[color:var(--success)]" : "text-destructive"
      )}
    >
      <Icon className="size-3.5" />
      {showText && <span>{good_ ? "healthy" : "watch"}</span>}
    </span>
  )
}
