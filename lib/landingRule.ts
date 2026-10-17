// Where someone lands when nothing else says where. Pure and client-safe.

/** Cookie set by whichever product last rendered for this browser. */
export const LAST_PRODUCT_COOKIE = "iv_product";
export type Product = "hire" | "practice";

export function parseProduct(value: string | undefined | null): Product | null {
  return value === "hire" || value === "practice" ? value : null;
}

/**
 * People who use both products go back to the one they used last. Without that
 * signal: Practice if they've set it up, their workspace if they haven't,
 * Practice onboarding if they have neither.
 */
export function pickLanding(o: { practiceSetUp: boolean; inWorkspace: boolean; last: Product | null }): "/dashboard" | "/hire" | "/onboarding" {
  if (o.inWorkspace && o.last === "hire") return "/hire";
  if (o.practiceSetUp) return "/dashboard";
  return o.inWorkspace ? "/hire" : "/onboarding";
}
