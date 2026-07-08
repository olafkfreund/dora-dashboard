"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-helpers"
import { writeAudit } from "@/lib/audit"
import { saveMetricConfig } from "@/lib/metrics/config-store"
import {
  DORA_METRIC_IDS,
  mergeConfig,
  metricConfigSchema,
  type PartialMetricConfig,
} from "@/lib/metrics/config"
import type { ActionState } from "@/lib/action-state"

const csv = (fd: FormData, name: string): string[] =>
  String(fd.get(name) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

/** Save the org-level metric definitions (deployment rules, window, DORA bands). */
export async function saveMetricConfigAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()

  const refRaw = String(formData.get("refPattern") ?? "").trim()
  const refPattern = refRaw === "" ? null : refRaw
  if (refPattern) {
    try {
      new RegExp(refPattern)
    } catch {
      return { ok: false, message: "Invalid ref pattern — must be a valid regular expression." }
    }
  }

  const failureStatuses = csv(formData, "failureStatuses")
  const bands = {} as PartialMetricConfig["bands"]
  for (const id of DORA_METRIC_IDS) {
    bands![id] = {
      elite: Number(formData.get(`band:${id}:elite`)),
      high: Number(formData.get(`band:${id}:high`)),
      medium: Number(formData.get(`band:${id}:medium`)),
    }
  }

  const partial: PartialMetricConfig = {
    deployment: {
      environments: csv(formData, "environments"),
      refPattern,
      // Empty = fall back to the default "failed" so nothing accidentally counts as always-passing.
      failureStatuses: failureStatuses.length ? failureStatuses : ["failed"],
    },
    windowWeeks: Number(formData.get("windowWeeks")),
    bands,
  }

  // Validate the fully-merged config (catches NaN band values, out-of-range window, etc.).
  const res = metricConfigSchema.safeParse(mergeConfig(partial))
  if (!res.success) {
    const first = res.error.issues[0]
    return { ok: false, message: `Invalid value at ${first.path.join(".") || "config"}: ${first.message}` }
  }

  await saveMetricConfig(partial, admin.id)
  await writeAudit(admin.id, "metric_config.update", "default", {
    environments: partial.deployment!.environments,
    windowWeeks: partial.windowWeeks,
    failureStatuses: partial.deployment!.failureStatuses,
  })
  revalidatePath("/settings")
  revalidatePath("/")
  return { ok: true, message: "Metric definitions saved." }
}

/** Reset all metric definitions back to the built-in DORA defaults (stores an empty config). */
export async function resetMetricConfigAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  await saveMetricConfig({}, admin.id)
  await writeAudit(admin.id, "metric_config.reset", "default")
  revalidatePath("/settings")
  revalidatePath("/")
  return { ok: true, message: "Reset to DORA defaults." }
}
