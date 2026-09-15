import type { Metadata } from "next";
import { AuthProvider } from "@/components/SessionProvider";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "inturview — practice recruiter screens and interviews",
  description:
    "Practice recruiter screens, behavioral answers, coding, and system design with an AI interviewer. Get follow-up questions and a structured debrief.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets data-theme on <html> before paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
