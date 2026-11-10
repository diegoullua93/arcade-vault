import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = {
  title: "Recuperar contraseña · Arcade Vault",
};

export default function ForgotPage() {
  return (
    <main className="av-main">
      <ForgotForm />
    </main>
  );
}
