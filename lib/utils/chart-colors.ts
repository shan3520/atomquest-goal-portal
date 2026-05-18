/**
 * Chart palette: literal OKLCH values that mirror the `--chart-N` tokens in
 * `app/globals.css`. SVG `fill`/`stroke` attributes don't resolve CSS custom
 * properties reliably, so we keep a parallel TypeScript constant. If the CSS
 * tokens move, update both.
 *
 * Strategy (Restrained product palette):
 *   - amber owns the brand's KPI line everywhere
 *   - emerald = "completed / success", consistent with .status-completed
 *   - indigo = baseline comparator (e.g. "Total" alongside "Completed")
 *   - muted = inactive/empty states (e.g. "Not Started")
 */
export const CHART = {
  amber: "oklch(0.75 0.18 75)", // --chart-1 / --primary
  emerald: "oklch(0.65 0.15 160)", // --chart-2 / status-completed family
  indigo: "oklch(0.6 0.2 260)", // --chart-3
  magenta: "oklch(0.7 0.15 330)", // --chart-4 (reserved; unused for now)
  red: "oklch(0.55 0.2 30)", // --chart-5 (reserved; unused for now)
  muted: "oklch(0.45 0.01 270)", // tinted neutral for inactive slices

  // Chart chrome (axis ticks, grid lines, tooltip surface). These mirror the
  // muted-foreground, border, and card tokens so the chart frame matches the
  // rest of the dark UI without an extra round of color picking.
  grid: "oklch(0.25 0.02 270)",
  axis: "oklch(0.6 0.01 270)",
  tooltipBg: "oklch(0.19 0.02 270)",
  tooltipBorder: "oklch(0.28 0.025 270)",
  tooltipText: "oklch(0.95 0.005 270)",
} as const;

/**
 * Semantic mapping for goal-status charts. Mirrors the visual language of
 * the .status-* badge utilities in globals.css, so a "completed" slice on
 * the donut reads the same as a "completed" pill on the goal sheet.
 */
export const STATUS_CHART_COLORS = {
  not_started: CHART.muted,
  on_track: CHART.amber,
  completed: CHART.emerald,
} as const;

/**
 * Reusable Recharts tooltip style. Inlined to avoid plumbing the same
 * style object through every chart instance.
 */
export const CHART_TOOLTIP_STYLE = {
  background: CHART.tooltipBg,
  border: `1px solid ${CHART.tooltipBorder}`,
  borderRadius: "8px",
  color: CHART.tooltipText,
} as const;
