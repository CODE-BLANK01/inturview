/** Public build-time feature gates. Features default to off unless explicitly enabled. */
export const FACE_TO_FACE_ENABLED =
  process.env.NEXT_PUBLIC_FACE_TO_FACE_ENABLED === "true";

/** Photoreal interviewer face (HeyGen LiveAvatar) in face-to-face interviews.
 *  Also needs LIVEAVATAR_API_KEY on the realtime service; without it the
 *  interview silently runs voice-only. */
export const FACE_TO_FACE_AVATAR_ENABLED =
  process.env.NEXT_PUBLIC_FACE_TO_FACE_AVATAR_ENABLED === "true";

/** Spoken practice rounds (OpenAI Realtime over WebRTC, audio only). Need
 *  OPENAI_API_KEY on the Next.js server. Off = that round is text chat only. */
export const RECRUITER_VOICE_ENABLED =
  process.env.NEXT_PUBLIC_RECRUITER_VOICE_ENABLED === "true";
export const BEHAVIORAL_VOICE_ENABLED =
  process.env.NEXT_PUBLIC_BEHAVIORAL_VOICE_ENABLED === "true";

export function voiceEnabledFor(kind: "BEHAVIORAL" | "RECRUITER_SCREEN"): boolean {
  return kind === "RECRUITER_SCREEN" ? RECRUITER_VOICE_ENABLED : BEHAVIORAL_VOICE_ENABLED;
}

/** Local/UI prototype only. No production Loop backend exists yet. */
export const LOOP_PREVIEW_ENABLED =
  process.env.NEXT_PUBLIC_LOOP_PREVIEW_ENABLED === "true";
