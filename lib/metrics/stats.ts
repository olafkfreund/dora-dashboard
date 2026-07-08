// Shared numeric helpers for the metric-compute modules.
export const DAY = 864e5

export function median(nums: number[]): number {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export const mean = (n: number[]) => (n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0)

export function trendOf(history: number[]): "up" | "down" | "flat" {
  const nz = history.filter((h) => h > 0)
  if (nz.length < 2) return "flat"
  const [prev, last] = [nz[nz.length - 2], nz[nz.length - 1]]
  return last > prev ? "up" : last < prev ? "down" : "flat"
}
