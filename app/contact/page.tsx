import {
  MarketingLayout,
  Section,
  SectionHeading,
  CtaBand,
  Eyebrow,
  Reveal,
} from "@/components/marketing";
import { ContactForm } from "@/components/ContactForm";
import { CONTACT_EMAIL, contactEmailHref } from "@/lib/contact";
export const metadata = {
  title: "Contact — inturview",
  description:
    "Questions, feedback, partnerships, or support. Get in touch with the Inturview team.",
};
export default function ContactPage({
  searchParams,
}: {
  searchParams?: { topic?: string };
}) {
  const employer = searchParams?.topic === "employers";
  return (
    <MarketingLayout>
      <Section className="m-contact-section">
        <div className="m-contact-grid">
          <Reveal hero>
            <SectionHeading
              as="h1"
              eyebrow="Contact / An open line"
              deck="A question, a rough edge, an idea worth building. Tell us what is on your mind. We read every message."
            >
              Good things start
              <br />
              with <em className="t-italic">hello.</em>
            </SectionHeading>
            <a
              className="m-contact-email"
              href={contactEmailHref(employer ? "employers" : "support")}
            >
              {CONTACT_EMAIL} ↗
            </a>
            <div className="m-contact-notes">
              <div>
                <Eyebrow>Product & account</Eyebrow>
                <p>
                  Include the page or session link and what you were trying to
                  do.
                </p>
              </div>
              <div>
                <Eyebrow>Partnerships</Eyebrow>
                <p>Tell us about your team and the role you are hiring for.</p>
              </div>
              <div>
                <Eyebrow>A real reply</Eyebrow>
                <p>We aim to respond within a few business days.</p>
              </div>
            </div>
          </Reveal>
          <Reveal hero delay={0.06}>
            <ContactForm employer={employer} />
          </Reveal>
        </div>
      </Section>
      <CtaBand
        title="Here to find your next step?"
        deck="Start with a practice round. We will be here if you need a hand."
      />
    </MarketingLayout>
  );
}
