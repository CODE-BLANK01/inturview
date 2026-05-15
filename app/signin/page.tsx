import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Sign in — intervue" };

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <Suspense>
        <AuthForm mode="signin" />
      </Suspense>
    </main>
  );
}
