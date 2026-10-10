import { Brand } from "@/components/Brand";

export default function DashboardLoading() {
  return (
    <div
      className="workspace"
      aria-busy="true"
      aria-label="Loading your dashboard"
    >
      <aside className="workspace-sidebar" aria-hidden="true">
        <div className="workspace-brand">
          <Brand wordmarkOnly />
        </div>
        <div className="mt-14 space-y-5 px-3">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="skeleton h-7 w-full" />
          ))}
        </div>
      </aside>
      <div className="workspace-body">
        <div className="workspace-topbar">
          <span className="workspace-mobile-brand">
            <Brand compact symbolOnly />
          </span>
        </div>
        <div className="workspace-main">
          <span role="status" className="sr-only">
            Getting your practice space ready…
          </span>
          <div aria-hidden="true">
            <div className="dashboard-welcome">
              <div className="space-y-4 py-4">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-9 w-3/4" />
                <div className="skeleton h-4 w-full max-w-sm" />
              </div>
              <div className="skeleton h-36" />
            </div>
            <div className="skeleton h-5 w-48 mb-4" />
            <div className="practice-cards">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="skeleton h-40" />
              ))}
            </div>
            <div className="dashboard-detail-grid">
              <div className="skeleton h-80" />
              <div className="skeleton h-80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
