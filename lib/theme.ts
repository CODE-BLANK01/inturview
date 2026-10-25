// Every color in the product comes from this file. Nothing else names a color:
// CSS, Tailwind classes, emails, the error page and the 2FA QR code all read
// from here, and `npm run check:colors` fails the build on a stray literal.
//
// Two tiers:
//   palette  the raw colors, each written once. Change a brand color here.
//   roles    what each color is for (page background, muted text, ...), per
//            theme. Re-point a role here to change one use without the rest.
//
// Roles become CSS variables holding RGB triplets (`--bg-page: 250 247 242`)
// so Tailwind's opacity modifier works: `bg-bg/85`, `rgb(var(--bg-page) / .85)`.
// See docs/design-system.md.

export const palette = {
  // Warm neutrals, lightest to darkest.
  sand: {
    0: "#FFFFFF",
    10: "#FFFAF2",
    20: "#FDFBF7",
    30: "#FAF7F2", // Parchment, the light page
    50: "#F2E8DA",
    60: "#F0EBE3", // Bone
    70: "#F0EAE0",
    100: "#E8E2D9", // Linen
    200: "#D4C9BE",
    300: "#C4B8AD",
    350: "#B8A99A",
    400: "#9A8B7E", // Ash
    500: "#75675B", // Whisper
    550: "#6B5E54", // Clay
    600: "#60544A",
    650: "#5A4D43",
    700: "#4A3F37",
    750: "#41352B",
    800: "#261C16",
    850: "#1F1712",
    870: "#1E1A16", // Soot
    900: "#1A1410", // Inkwell
    930: "#141210",
    950: "#0E0C0A", // Char, the dark page
    1000: "#000000",
  },
  // The brand accent.
  ember: {
    50: "#FDEDE1",
    300: "#E8A67B",
    400: "#E8845A",
    500: "#E26C2F", // the logo
    600: "#C4541A",
    700: "#9A3D18",
    800: "#8B4321",
    950: "#312219",
  },
  green: { 100: "#D4EDDA", 400: "#64AA77", 700: "#2D6A3F", 900: "#1A3D28" },
  amber: { 100: "#FDEBC8", 400: "#C49A3A", 700: "#7A4F1A", 900: "#2E2010" },
  red: { 100: "#F9D0D0", 400: "#DC6E68", 700: "#8B1A1A", 900: "#2E1010" },
  // Practice card illustrations: [background, ink] per category.
  art: {
    recruiter: ["#F0E5DA", "#B47450"],
    behavioral: ["#F7EEE2", "#B58B52"],
    coding: ["#F0E8DE", "#80624E"],
    design: ["#F3EDE5", "#8A705D"],
  },
} as const;

type Hex = `#${string}`;
const { sand, ember, green, amber, red, art } = palette;

/** Light theme. Every role the product uses is listed here. */
export const light = {
  "bg-page": sand[30], // never pure white
  "bg-surface": sand[0],
  "bg-inset": sand[70],
  "bg-inverse": sand[900],

  "text-primary": sand[900],
  "text-secondary": sand[550],
  "text-tertiary": sand[500],
  "text-secondary-inverse": sand[300], // muted text on inverse bands
  "text-tertiary-inverse": sand[350], // eyebrows and dim text on inverse bands
  "text-ember": ember[600], // the accent; Instrument Serif italic only on the landing
  "text-ember-inverse": ember[300],
  "text-inverse": sand[30],
  "text-on-accent": sand[0], // text on an accent-filled surface

  "border-base": sand[100],
  "border-strong": sand[200],

  "brand-soft": ember[50],
  "brand-ink": ember[800],
  "brand-band": sand[800],
  "art-paper": sand[10],

  "score-hire": green[700],
  "score-hire-bg": green[100],
  "score-maybe": amber[700],
  "score-maybe-bg": amber[100],
  "score-no": red[700],
  "score-no-bg": red[100],
} satisfies Record<string, Hex>;

export type Role = keyof typeof light;

/** Dark theme: must re-point every light role. */
export const dark: Record<Role, Hex> = {
  "bg-page": sand[950], // never pure black
  "bg-surface": sand[930],
  "bg-inset": sand[870],
  "bg-inverse": sand[60],

  "text-primary": sand[60],
  "text-secondary": sand[400],
  "text-tertiary": sand[400],
  "text-secondary-inverse": sand[650],
  "text-tertiary-inverse": sand[600],
  "text-ember": ember[400],
  "text-ember-inverse": ember[700],
  "text-inverse": sand[950],
  "text-on-accent": sand[950],

  "border-base": sand[870],
  "border-strong": sand[750],

  "brand-soft": ember[950],
  "brand-ink": ember[300],
  "brand-band": sand[850],
  "art-paper": sand[50],

  "score-hire": green[400],
  "score-hire-bg": green[900],
  "score-maybe": amber[400],
  "score-maybe-bg": amber[900],
  "score-no": red[400],
  "score-no-bg": red[900],
};

/** The same in both themes. */
export const fixed = {
  "brand-logo": ember[500],
  overlay: sand[1000], // behind dialogs, used with opacity
  shadow: sand[900], // used with opacity
  highlight: sand[0], // a specular glint, used with opacity
  "stage-bg": sand[950], // the live interview video stage is always dark
  "stage-text": sand[60],
  "stage-edge": sand[0],
  "email-canvas": sand[0], // what an email client shows around a message
  "art-recruiter-bg": art.recruiter[0],
  "art-recruiter-ink": art.recruiter[1],
  "art-behavioral-bg": art.behavioral[0],
  "art-behavioral-ink": art.behavioral[1],
  "art-coding-bg": art.coding[0],
  "art-coding-ink": art.coding[1],
  "art-design-bg": art.design[0],
  "art-design-ink": art.design[1],
} satisfies Record<string, Hex>;

/** The public site's own surfaces (a deeper inverse band, a warmer surface). */
export const publicSite = {
  light: { "bg-inverse": sand[950], "bg-surface": sand[20] },
  dark: { "bg-inverse": sand[60], "bg-surface": sand[930] },
} satisfies Record<"light" | "dark", Partial<Record<Role, Hex>>>;

/** "#FAF7F2" → "250 247 242" */
export function triplet(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function vars(roles: Record<string, string>) {
  return Object.fromEntries(Object.entries(roles).map(([k, v]) => [`--${k}`, triplet(v)]));
}

/** The CSS custom properties, by selector. Tailwind injects these (tailwind.config.ts). */
export function cssVariables(): Record<string, Record<string, string>> {
  return {
    ":root": { ...vars(fixed), ...vars(light), "color-scheme": "light" },
    '[data-theme="dark"]': { ...vars(dark), "color-scheme": "dark" },
    ".public-site": vars(publicSite.light),
    '[data-theme="dark"] .public-site': vars(publicSite.dark),
  };
}

/**
 * Hex values for places CSS variables can't reach: email HTML, the
 * pre-stylesheet error page, generated images. Emails are always light.
 */
export const inlineColors = {
  page: light["bg-page"],
  text: light["text-primary"],
  muted: light["text-secondary"],
  quote: sand[700],
  rule: light["border-base"],
  button: light["bg-inverse"],
  buttonText: light["text-inverse"],
};
