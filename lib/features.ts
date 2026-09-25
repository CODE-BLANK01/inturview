/** Public build-time feature gates. Features default to off unless explicitly enabled. */
export const FACE_TO_FACE_ENABLED =
  process.env.NEXT_PUBLIC_FACE_TO_FACE_ENABLED === "true";
