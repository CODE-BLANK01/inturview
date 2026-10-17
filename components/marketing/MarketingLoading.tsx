import { Skeleton } from "@/components/ui/Skeleton";
import { MarketingLayout, Section } from ".";

export function MarketingLoading({
  page,
}: {
  page: "home" | "pricing" | "employers" | "about" | "contact";
}) {
  const heading = (
    <div>
      <Skeleton w="12rem" h={12} className="mb-6" />
      <Skeleton
        className={`m-loading-title ${page === "home" ? "" : "m-loading-title-short"}`}
      />
      <Skeleton className="m-loading-deck" />
      <Skeleton className="m-loading-actions" />
    </div>
  );
  return (
    <MarketingLayout>
      <div aria-busy="true" aria-label="Loading page">
        <span className="sr-only" role="status">
          Loading…
        </span>
        <Section
          className={
            page === "home"
              ? "m-home-hero"
              : page === "employers"
                ? "m-employer-hero"
                : ""
          }
        >
          {page === "home" ? (
            <>
              <div className="m-hero-grid">
                {heading}
                <Skeleton className="m-loading-preview" />
              </div>
              <div className="m-hero-bottom">
                <Skeleton h={18} w="100%" />
              </div>
            </>
          ) : page === "contact" ? (
            <div className="m-contact-grid">
              {heading}
              <Skeleton className="m-loading-preview" />
            </div>
          ) : (
            <>
              {heading}
              {page === "pricing" && (
                <div className="m-plan-grid">
                  <Skeleton className="m-loading-plan" />
                  <Skeleton className="m-loading-plan" />
                </div>
              )}
              {page === "employers" && <Skeleton h={270} />}
            </>
          )}
        </Section>
        <Section tone={page === "home" ? "inset" : "inverse"}>
          <Skeleton className="m-loading-belief" />
        </Section>
      </div>
    </MarketingLayout>
  );
}
