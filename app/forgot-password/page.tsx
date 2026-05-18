import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata = { title: "Reset password — inturview" };

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <ForgotPasswordForm />
    </main>
  );
}
