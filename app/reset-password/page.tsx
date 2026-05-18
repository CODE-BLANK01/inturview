import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const metadata = { title: "Set new password — inturview" };

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
