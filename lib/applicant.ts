// Copy and formatting for the applicant pages (/i/[token]). Pure; unit-tested.

export interface ApplicantCompany {
  name: string;
  timezone: string;
  contactEmail: string | null;
  logoUrl: string | null;
  website: string | null;
}

/** "Wednesday, October 28 at 11:59 PM EDT", in the company's timezone. */
export function companyTime(at: Date, timezone: string): string {
  const tz = isTimeZone(timezone) ? timezone : "UTC";
  const date = at.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz });
  const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "short" });
  return `${date} at ${time}`;
}

/** When an invitation link stops working, as applicants read it. */
export const deadlineText = companyTime;

function isTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Who an applicant asks for help or adjustments. */
export function contactFor(company: ApplicantCompany | null): { label: string; href: string | null } {
  if (company?.contactEmail) return { label: company.contactEmail, href: `mailto:${company.contactEmail}` };
  return { label: "the email your invitation came from", href: null };
}
