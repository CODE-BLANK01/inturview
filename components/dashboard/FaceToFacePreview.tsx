import Link from "next/link";
import { ArrowUpRight, Video } from "lucide-react";
import { FACE_TO_FACE_ENABLED } from "@/lib/features";

export function FaceToFacePreview() {
  return (
    <section className="face-preview">
      <Video size={23} strokeWidth={1.5} aria-hidden="true" />
      <div className="face-preview-copy">
        <div>
          <h2>Face-to-face practice</h2>
          <span className="face-preview-badge">{FACE_TO_FACE_ENABLED ? "Early access" : "Coming soon"}</span>
        </div>
        <p>Practice the conversation, out loud.</p>
        {FACE_TO_FACE_ENABLED ? (
          <Link href="/face-to-face" className="face-preview-link">Try face-to-face <ArrowUpRight size={13} /></Link>
        ) : (
          <a href="mailto:hello@inturview.com?subject=Face-to-face%20early%20access" className="face-preview-link">Join the waitlist <ArrowUpRight size={13} /></a>
        )}
      </div>
    </section>
  );
}
