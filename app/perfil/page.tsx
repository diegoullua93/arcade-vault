import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignOutButton } from "@/components/profile/sign-out-button";
import { PLAYABLE_GAME_IDS } from "@/lib/games";
import { getGames } from "@/lib/queries/games";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Perfil · Arcade Vault",
};

export default function ProfilePage() {
  return (
    <main className="av-main">
      <Suspense fallback={<div className="av-profile" />}>
        <Profile />
      </Suspense>
    </main>
  );
}

async function Profile() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  // El proxy redirigirá sin sesión (paso 7); esto cubre el caso en que se salte.
  if (!data.user) redirect("/auth?next=/perfil");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) redirect("/auth/username?next=/perfil");

  const games = (await getGames()).filter((g) => PLAYABLE_GAME_IDS.includes(g.id));
  const bests = await Promise.all(
    games.map(async (g) => {
      const { data: best } = await supabase.rpc("get_player_best", {
        p_game_id: g.id,
        p_player_name: profile.username,
      });
      return { game: g, best: best?.[0] ?? null };
    }),
  );

  return (
    <div className="av-profile fade-in">
      <header className="profile-head">
        <div className="profile-avatar" aria-hidden="true">
          {profile.username.slice(0, 2)}
        </div>
        <div>
          <h2 className="neon-cyan">{profile.username}</h2>
          <div className="profile-mail">{data.user.email}</div>
        </div>
      </header>

      <section className="profile-marks" aria-labelledby="profile-marks-title">
        <h3 id="profile-marks-title">TUS MEJORES MARCAS</h3>
        <ul>
          {bests.map(({ game, best }) => (
            <li key={game.id}>
              <Link href={`/juegos/${game.id}`} className="pm-game">
                {game.title}
              </Link>
              {best ? (
                <span className="pm-score">
                  <b>{best.score.toLocaleString("es-ES")}</b>
                  <em>#{best.rank}</em>
                </span>
              ) : (
                <Link href={`/juegos/${game.id}/jugar`} className="pm-empty">
                  Sin marca. Juega la primera
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <SignOutButton />
    </div>
  );
}
