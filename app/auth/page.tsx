import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Acceso · Arcade Vault",
};

export default function AuthPage(props: PageProps<"/auth">) {
  return (
    <main className="av-main">
      <Suspense fallback={<div className="av-auth-wrap" />}>
        <AuthContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function AuthContent({ searchParams }: { searchParams: PageProps<"/auth">["searchParams"] }) {
  const { next, error } = await searchParams;
  return (
    <AuthForm
      next={typeof next === "string" ? next : undefined}
      callbackError={error === "callback"}
    />
  );
}
