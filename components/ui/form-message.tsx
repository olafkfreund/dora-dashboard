import { cn } from "@/lib/utils"
import type { ActionState } from "@/lib/action-state"

/** Success/error message block for form server-action results. */
export function FormMessage({
  state,
  className,
}: {
  state: ActionState
  className?: string
}) {
  if (!state?.message) return null
  return (
    <p
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        state.ok
          ? "border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[color:var(--success)]"
          : "border-destructive/30 bg-destructive/10 text-destructive",
        className
      )}
    >
      {state.message}
    </p>
  )
}
