import type { Metadata } from "next";
import { Suspense } from "react";
import { UsernameForm } from "@/components/auth/username-form";

export const metadata: Metadata = {
  title: "Elige tu nombre · Arcade Vault",
};

export default function UsernamePage(props: PageProps<"/auth/username">) {
  return (
    <main className="av-main">
      <Suspense fallback={<div className="av-auth-wrap" />}>
        <UsernameContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function UsernameContent({
  searchParams,
}: {
  searchParams: PageProps<"/auth/username">["searchParams"];
}) {
  const { next } = await searchParams;
  return <UsernameForm next={typeof next === "string" ? next : undefined} />;
}
