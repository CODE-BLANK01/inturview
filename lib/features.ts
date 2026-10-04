/** Public build-time feature gates. Features default to off unless explicitly enabled. */
export const FACE_TO_FACE_ENABLED =
  process.env.NEXT_PUBLIC_FACE_TO_FACE_ENABLED === "true";

/** Photoreal interviewer face (HeyGen LiveAvatar) in face-to-face interviews.
 *  Also needs LIVEAVATAR_API_KEY on the realtime service; without it the
 *  interview silently runs voice-only. */
export const FACE_TO_FACE_AVATAR_ENABLED =
  process.env.NEXT_PUBLIC_FACE_TO_FACE_AVATAR_ENABLED === "true";
