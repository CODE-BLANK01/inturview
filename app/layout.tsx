import type { Metadata } from "next";
import { AuthProvider } from "@/components/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "inturview — practice technical interviews with an AI interviewer",
  description:
    "Walk through NeetCode 150 problems in a three-phase mock interview: approach, code, debrief. Get a rubric-based score and detailed feedback.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
