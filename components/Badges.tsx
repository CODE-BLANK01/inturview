import type { CSSProperties } from "react";
import type { Difficulty, Recommendation } from "@/lib/types";

export function DifficultyBadge({ value }: { value: Difficulty }) {
  const styles: Record<Difficulty, string> = {
    Easy: "border-easy/40 bg-easy/10 text-easy",
    Medium: "border-medium/40 bg-medium/10 text-medium",
    Hard: "border-hard/40 bg-hard/10 text-hard",
  };
  return <span className={`badge ${styles[value]}`}>{value}</span>;
}

export function TopicBadge({ value }: { value: string }) {
  return (
    <span className="badge border-border bg-bg-surface text-text-muted">{value}</span>
  );
}

/* ---------------------------------------------------------------------------
 * RecommendationBadge — 5-band hiring rubric.
 *
 *   Strong Hire     solid green        ← emphatic positive
 *   Hire            tinted green
 *   Lean Hire       tinted amber       ← borderline; warm but cautious
 *   No Hire         tinted red
 *   Strong No Hire  solid red          ← emphatic negative
 *
 * Solid extremes use inline styles against the score CSS variables (no
 * Tailwind tokens for "score bg with inverse text" combo). Middle three
 * use existing tinted-badge utilities.
 * ------------------------------------------------------------------------- */

interface BandStyle {
  /** Inline style applied to the badge span. Used for the solid extremes
   *  where we want a true filled background. */
  style?: CSSProperties;
  /** Tailwind class string. Used for tinted middle bands. */
  className?: string;
}

const BAND_STYLES: Record<Recommendation, BandStyle> = {
  "Strong Hire": {
    style: {
      background: "rgb(var(--score-hire))",
      color: "rgb(var(--text-inverse))",
      borderColor: "rgb(var(--score-hire))",
      fontWeight: 700,
    },
  },
  Hire: {
    className:
      "border-easy/45 bg-easy-bg/70 text-easy font-semibold",
  },
  "Lean Hire": {
    className:
      "border-medium/45 bg-medium-bg/70 text-medium font-semibold",
  },
  "No Hire": {
    className:
      "border-hard/45 bg-hard-bg/70 text-hard font-semibold",
  },
  "Strong No Hire": {
    style: {
      background: "rgb(var(--score-no))",
      color: "rgb(var(--text-inverse))",
      borderColor: "rgb(var(--score-no))",
      fontWeight: 700,
    },
  },
};

export function RecommendationBadge({ value }: { value: Recommendation }) {
  // Legacy rows may have raw strings that don't match the union (or future
  // bands we haven't seen yet). Fall back to a neutral badge in that case.
  const band: BandStyle =
    BAND_STYLES[value] ?? {
      className: "border-border bg-bg-surface text-text-muted",
    };

  return (
    <span
      className={`badge px-3 py-1 text-sm ${band.className ?? ""}`}
      style={band.style}
    >
      {value}
    </span>
  );
}
