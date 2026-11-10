import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/reset-form";

export const metadata: Metadata = {
  title: "Nueva contraseña · Arcade Vault",
};

export default function ResetPage() {
  return (
    <main className="av-main">
      <ResetForm />
    </main>
  );
}
