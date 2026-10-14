import { ThemeToggle } from "@/components/ThemeToggle";
import type { ApplicantCompany } from "@/lib/applicant";

/**
 * The applicant's frame: the hiring company first, inturview second. No
 * practice navigation, sign-in links or marketing.
 */
export function ApplicantShell({ company, children }: { company: ApplicantCompany | null; children: React.ReactNode }) {
  const name = company?.name ?? "Your interview";
  return (
    <div className="auth-shell">
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
