import Link from "next/link";
import { ArrowRight, Code2, Layers, MessageCircle, FileText } from "lucide-react";

const modes = [
  { title: "Recruiter screen", description: "Tell your story with confidence.", href: "/recruiter-screen", icon: FileText },
  { title: "Behavioral", description: "Turn experience into clear answers.", href: "/behavioral", icon: MessageCircle },
  { title: "Coding", description: "Solve problems. Explain your thinking.", href: "/problems", icon: Code2 },
  { title: "System design", description: "Build a system. Explore the trade-offs.", href: "/design-problems", icon: Layers },
];

export function PracticeModes() {
  return (
    <section id="practice" className="practice-section" aria-labelledby="practice-heading">
      <div className="section-heading practice-section-heading">
        <h2 id="practice-heading">Practice an interview</h2>
        <span>Four ways to prepare</span>
      </div>
      <div className="practice-cards">
        {modes.map(({ title, description, href, icon: Icon }) => (
          <Link href={href} key={href} className="practice-card">
            <Icon size={25} strokeWidth={1.5} className="practice-mode-icon" aria-hidden="true" />
            <h3>{title}</h3>
            <div className="practice-card-bottom">
              <p>{description}</p>
              <span className="practice-card-arrow" aria-hidden="true"><ArrowRight size={16} /></span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
