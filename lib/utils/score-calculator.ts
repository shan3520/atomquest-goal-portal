import { type UomType } from "@/types";

/**
 * Calculate the achievement score for a goal based on its UoM type.
 * All scores are capped at 100.
 */
export function computeScore(
  uomType: UomType,
  targetValue: number | null,
  actualValue: number | null,
  targetDate: string | null,
  actualDate: string | null
): number {
  switch (uomType) {
    case "numeric_min":
    case "percent_min": {
      // Higher is better: score = (actual / target) * 100
      if (!targetValue || targetValue === 0 || actualValue === null) return 0;
      return Math.min((actualValue / targetValue) * 100, 100);
    }

    case "numeric_max":
    case "percent_max": {
      // Lower is better: score = (target / actual) * 100
      if (!targetValue || actualValue === null || actualValue === 0) return 0;
      return Math.min((targetValue / actualValue) * 100, 100);
    }

    case "timeline": {
      // On time = 100, late = 0
      if (!targetDate || !actualDate) return 0;
      return new Date(actualDate) <= new Date(targetDate) ? 100 : 0;
    }

    case "zero": {
      // Zero tolerance: actual must be exactly 0
      if (actualValue === null) return 0;
      return actualValue === 0 ? 100 : 0;
    }

    default:
      return 0;
  }
}

/**
 * Get the score text color class. Thresholds: <50 red, 50-79 yellow, >=80 green.
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

/**
 * Get score background class for visual indicators.
 */
export function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-emerald-500/20";
  if (score >= 50) return "bg-amber-500/20";
  return "bg-red-500/20";
}

/**
 * Full badge class (bg + text + border) — for use on Badge components.
 */
export function getScoreBadgeClass(score: number | null): string {
  if (score === null || score === undefined)
    return "bg-zinc-700/40 text-zinc-300 border border-zinc-600/50";
  if (score >= 80)
    return "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30";
  if (score >= 50)
    return "bg-amber-600/20 text-amber-400 border border-amber-500/30";
  return "bg-red-600/20 text-red-400 border border-red-500/30";
}

/**
 * Format score for display.
 */
export function formatScore(score: number | null): string {
  if (score === null || score === undefined) return "—";
  return `${Math.round(score * 10) / 10}%`;
}
