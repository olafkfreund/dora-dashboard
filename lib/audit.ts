import "server-only"
import { db } from "@/db"
import { auditLogs } from "@/db/schema"

/** Record a privileged action in the audit log. */
export async function writeAudit(
  actorId: string,
  action: string,
  target: string,
  meta: Record<string, unknown> = {}
) {
  await db.insert(auditLogs).values({ actorId, action, target, meta })
}
