import { AuthShell } from "@/components/AuthShell";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Sign in — inturview" };

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  return (
    <AuthShell>
      <Suspense>
        <AuthForm mode="signin" />
      </Suspense>
    </AuthShell>
  );
}
