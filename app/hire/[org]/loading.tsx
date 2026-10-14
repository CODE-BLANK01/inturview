// Keeps the workspace shell on screen while a page loads (the root loading
// screen is the marketing one).
export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded bg-bg-inset" />
      <div className="h-4 w-72 rounded bg-bg-inset" />
      <div className="h-40 rounded-lg bg-bg-inset" />
    </div>
  );
}
