"use client"

import * as React from "react"

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    const on = () => setReduced(mq.matches)
    mq.addEventListener?.("change", on)
    return () => mq.removeEventListener?.("change", on)
  }, [])
  return reduced
}

/** Animated count-up for the leading numeric portion of a value string. */
export function CountUp({
  value,
  durationMs = 900,
  className,
}: {
  value: string
  durationMs?: number
  className?: string
}) {
  const reduced = usePrefersReducedMotion()
  const match = value.match(/^([\d.]+)(.*)$/)
  const target = match ? parseFloat(match[1]) : NaN
  const suffix = match ? match[2] : value
  const decimals = match && match[1].includes(".") ? 1 : 0
  const [display, setDisplay] = React.useState(reduced || isNaN(target) ? target : 0)

  React.useEffect(() => {
    if (isNaN(target) || reduced) {
      setDisplay(target)
      return
    }
    let raf = 0
    let start = 0
    const tick = (t: number) => {
      if (!start) start = t
      const p = Math.min(1, (t - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, reduced])

  if (isNaN(target)) return <span className={className}>{value}</span>
  return (
    <span className={className}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  )
}

function pointsFor(data: number[], w: number, h: number, pad: number) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const step = (w - pad * 2) / (data.length - 1)
  return data.map((v, i) => {
    const x = pad + i * step
    const y = pad + (1 - (v - min) / span) * (h - pad * 2)
    return [x, y] as const
  })
}

/** Simple line + soft area. Used in the detail dialog. */
export function Sparkline({
  data,
  color,
  height = 64,
}: {
  data: number[]
  color: string
  height?: number
}) {
  const width = 320
  const pad = 6
  const pts = pointsFor(data, width, height, pad)
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ")
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-16 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend over the last 8 periods"
    >
      <polygon points={area} fill={color} opacity={0.12} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 3 : 0} fill={color} />
      ))}
    </svg>
  )
}

/** Colored vertical bar chart (Charts view). */
export function BarChart({
  data,
  color,
  height = 96,
  animate = false,
}: {
  data: number[]
  color: string
  height?: number
  animate?: boolean
}) {
  const width = 320
  const pad = 4
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const n = data.length
  const gap = 6
  const bw = (width - pad * 2 - gap * (n - 1)) / n
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      role="img"
      aria-label="Per-period bar chart"
    >
      {data.map((v, i) => {
        const bh = pad + ((v - min) / span) * (height - pad * 2) * 0.92 + 4
        const x = pad + i * (bw + gap)
        const y = height - bh
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={bw}
            height={bh}
            rx={3}
            fill={color}
            opacity={0.35 + (0.65 * i) / (n - 1)}
            className={animate ? "metric-bar" : undefined}
            style={
              animate
                ? ({ transformOrigin: `${x + bw / 2}px ${height}px`, animationDelay: `${i * 55}ms` } as React.CSSProperties)
                : undefined
            }
          />
        )
      })}
    </svg>
  )
}

/**
 * Gradient area chart with an animated draw-in line (Modern view).
 * Uses pathLength=1 so stroke-dashoffset animation is resolution-independent.
 */
export function GradientAreaChart({
  data,
  color,
  id,
  height = 120,
  animate = true,
}: {
  data: number[]
  color: string
  id: string
  height?: number
  animate?: boolean
}) {
  const width = 320
  const pad = 8
  const pts = pointsFor(data, width, height, pad)
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ")
  const areaPath = `M ${pad},${height - pad} L ${line
    .split(" ")
    .map((p) => p.replace(",", " "))
    .join(" L ")} L ${width - pad},${height - pad} Z`
  const linePath = `M ${pts.map(([x, y]) => `${x} ${y}`).join(" L ")}`
  const gradId = `grad-${id}`
  const glowId = `glow-${id}`
  const [last] = pts.slice(-1)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      role="img"
      aria-label="Animated trend area chart"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} className={animate ? "metric-area" : undefined} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        filter={`url(#${glowId})`}
        className={animate ? "metric-line" : undefined}
        vectorEffect="non-scaling-stroke"
      />
      {last && (
        <circle
          cx={last[0]}
          cy={last[1]}
          r={4}
          fill={color}
          filter={`url(#${glowId})`}
          className={animate ? "metric-dot" : undefined}
        />
      )}
    </svg>
  )
}

/** Animated radial gauge for percentage-like metrics (Modern view). */
export function RadialGauge({
  percent,
  color,
  id,
  size = 120,
  animate = true,
  children,
}: {
  percent: number
  color: string
  id: string
  size?: number
  animate?: boolean
  children?: React.ReactNode
}) {
  const stroke = 10
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const clamped = Math.max(0, Math.min(100, percent))
  const gradId = `gauge-${id}`
  const glowId = `gauge-glow-${id}`
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.5" />
          </linearGradient>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - clamped / 100}
          filter={`url(#${glowId})`}
          className={animate ? "metric-gauge" : undefined}
          style={{ ["--gauge-to" as string]: String(1 - clamped / 100) }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
