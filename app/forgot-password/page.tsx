import { AuthShell } from "@/components/AuthShell";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata = { title: "Reset password — inturview" };

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
