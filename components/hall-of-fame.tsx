"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session-provider";
import type { Game } from "@/lib/games";
import type { LeaderboardRow } from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/client";

const fmt = (n: number) => n.toLocaleString("es-ES");
const pad = (n: number) => String(n).padStart(2, "0");

// Misma zona y locale que el servidor (lib/queries/scores.ts).
const dateFormat = new Intl.DateTimeFormat("es-ES", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type PlayerBest = { rank: number; score: number; date: string };

export function HallOfFame({
  games,
  rowsByGame,
}: {
  games: Game[];
  rowsByGame: Record<string, LeaderboardRow[]>;
}) {
  const { user } = useSession();
  const [tab, setTab] = useState(games[0]?.id ?? "");
  const rows = rowsByGame[tab] ?? [];
  const game = games.find((g) => g.id === tab);

  // «Tu mejor marca»: el servidor no conoce el nombre de la sesión mock,
  // así que se consulta desde el navegador tras montar.
  const name = user?.name ?? null;
  const key = name ? `${tab}:${name}` : null;
  const [best, setBest] = useState<{ key: string; data: PlayerBest | null } | null>(null);

  useEffect(() => {
    if (!name || !key) return;
    let cancelled = false;
    createClient()
      .rpc("get_player_best", { p_game_id: tab, p_player_name: name })
      .then(({ data, error }) => {
        if (cancelled) return;
        const row = !error && data && data.length > 0 ? data[0] : null;
        setBest({
          key,
          data: row
            ? {
                rank: row.rank,
                score: row.score,
                date: dateFormat.format(new Date(row.created_at)),
              }
            : null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [tab, name, key]);

  const youBest = best && best.key === key ? best.data : null;

  const first = rows[0];
  const second = rows[1];
  const third = rows[2];

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      <div className="podium">
        <PodiumSlot className="silver" rank="02" row={second} />
        <PodiumSlot className="gold" rank="01" row={first} champion />
        <PodiumSlot className="bronze" rank="03" row={third} />
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.length === 0 && (
          <div className="tr empty">
            AÚN NO HAY PUNTUACIONES EN {game?.title}. ¡SÉ EL PRIMERO EN LA TABLA!
          </div>
        )}
        {rows.map((r, i) => (
          <div
            key={tab + r.name}
            className={"tr" + (i < 3 ? ` top${i + 1}` : "")}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="rk">#{pad(r.rank)}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{fmt(r.score)}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
        {youBest && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {game?.title}</div>
            <div className="tr you" style={{ animationDelay: `${rows.length * 50 + 50}ms` }}>
              <div className="rk" style={{ color: "var(--yellow)" }}>
                #{pad(youBest.rank)}
              </div>
              <div className="pl" style={{ color: "var(--yellow)" }}>
                {name}
              </div>
              <div
                className="sc"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                {fmt(youBest.score)}
              </div>
              <div className="dt">{youBest.date}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/biblioteca" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}

function PodiumSlot({
  className,
  rank,
  row,
  champion = false,
}: {
  className: string;
  rank: string;
  row: LeaderboardRow | undefined;
  champion?: boolean;
}) {
  return (
    <div className={"podium-slot " + className + (row ? "" : " vacant")}>
      {champion && (
        <div
          className="pixel"
          style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}
        >
          CAMPEÓN
        </div>
      )}
      <div className="rank-num" style={champion ? { fontSize: 36, marginTop: 4 } : undefined}>
        {rank}
      </div>
      <div className="name">{row ? row.name : "VACANTE"}</div>
      <div className="score" style={champion ? { fontSize: 20 } : undefined}>
        {row ? fmt(row.score) : "—"}
      </div>
      <div className="date">{row ? row.date : ""}</div>
    </div>
  );
}
