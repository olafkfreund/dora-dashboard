import "server-only"
import { db } from "@/db"
import { auditLogs } from "@/db/schema"

/**
 * Record a privileged action in the audit log. Best-effort: a failed audit write
 * must never break the primary operation, so errors are swallowed (and logged).
 */
export async function writeAudit(
  actorId: string,
  action: string,
  target: string,
  meta: Record<string, unknown> = {}
) {
  try {
    await db.insert(auditLogs).values({ actorId, action, target, meta })
  } catch (e) {
    console.error("audit write failed:", e instanceof Error ? e.message : e)
  }
}
