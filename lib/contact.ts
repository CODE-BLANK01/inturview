import { z } from "zod";

export const CONTACT_EMAIL = "hello@inturview.com";
export const CONTACT_SUBJECTS = {
  support: "Inturview — contact enquiry",
  employers: "Inturview Hire — design partner enquiry",
} as const;

export function contactEmailHref(topic: keyof typeof CONTACT_SUBJECTS) {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(CONTACT_SUBJECTS[topic])}`;
}

export const ContactSchema = z.object({
  name: z.string().trim().max(80, "Keep your name under 80 characters."),
  email: z.string().trim().email("Enter a valid email address.").max(200),
  message: z
    .string()
    .trim()
    .min(10, "Please add a little more detail (at least 10 characters).")
    .max(5000, "Keep your message under 5,000 characters."),
  topic: z.enum(["support", "employers"]),
  website: z.string().max(200).optional(),
});
export type ContactInput = z.infer<typeof ContactSchema>;
export type ContactErrors = Partial<Record<keyof ContactInput, string[]>>;
