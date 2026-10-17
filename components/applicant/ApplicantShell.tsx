import { ThemeToggle } from "@/components/ThemeToggle";
import type { ApplicantCompany } from "@/lib/applicant";

/**
 * The applicant's frame: the hiring company first, inturview second. No
 * practice navigation, sign-in links or marketing.
 */
export function ApplicantShell({ company, preview = false, children }: { company: ApplicantCompany | null; preview?: boolean; children: React.ReactNode }) {
  const name = company?.name ?? "Your interview";
  return (
    <div className="auth-shell">
      {preview && (
        <div role="status" className="bg-medium/10 border-b border-medium/40 text-sm px-4 py-2 text-center">
          <strong>Preview.</strong> This is exactly what candidates see. Nothing is emailed, and it isn&apos;t listed with your candidates.
        </div>
      )}
      <header className="auth-header">
        <div className="flex items-center gap-3 min-w-0">
          {company?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- company-provided URL, not a local asset
            <img src={company.logoUrl} alt={`${name} logo`} className="h-8 w-auto max-w-[160px] object-contain" />
          ) : (
            <span className="text-lg font-semibold truncate">{name}</span>
          )}
        </div>
        <ThemeToggle />
      </header>
      <main className="auth-main">{children}</main>
      <footer className="auth-footer">
        {company ? `${company.name} runs this interview with inturview.` : "Interview by inturview."} You don&apos;t need an account.
      </footer>
    </div>
  );
}
