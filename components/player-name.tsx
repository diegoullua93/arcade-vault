"use client";

import { useSession } from "@/components/session-provider";

export function PlayerName() {
  const { user } = useSession();
  return <>{user ? user.name : "INVITADO"}</>;
}
