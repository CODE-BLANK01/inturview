import type { Metadata } from "next";
import { AuthProvider } from "@/components/SessionProvider";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "inturview — practice technical interviews with an AI interviewer",
  description:
    "Walk through NeetCode 150 problems in a three-phase mock interview: approach, code, debrief. Get a rubric-based score and detailed feedback.",
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
