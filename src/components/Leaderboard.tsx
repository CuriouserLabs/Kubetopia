"use client";

import { useEffect, useState } from "react";
import { fetchCampaignBoard } from "@/lib/online/board";
import { levelsForTrack, TRACKS } from "@/lib/levels";
import type { TrackId } from "@/lib/levels/types";
import type { LeaderboardEntry } from "@/lib/online/types";
import { useAuthStore } from "@/store/authStore";

const MEDALS = ["👑", "🥈", "🥉"] as const;
const PODIUM_LABEL = ["Champion", "Runner-up", "Third"] as const;

/** In-sim ticks tick once per second → m:ss. */
function formatTime(ticks: number): string {
  if (!ticks) return "—";
  const m = Math.floor(ticks / 60);
  const s = ticks % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Avatar({ entry }: { entry: LeaderboardEntry }) {
  if (entry.photoURL) {
    // eslint-disable-next-line @next/next/no-img-element -- tiny remote avatar
    return <img src={entry.photoURL} alt="" className="lb__avatar" referrerPolicy="no-referrer" />;
  }
  const letter = (entry.displayName?.trim()[0] ?? "?").toUpperCase();
  return <span className="lb__avatar lb__avatar--fallback" aria-hidden>{letter}</span>;
}

export default function Leaderboard({ initialTrack }: { initialTrack: TrackId }) {
  const [track, setTrack] = useState<TrackId>(initialTrack);
  // Keep the loaded rows tagged with their track so switching tabs shows the
  // loading state (derived) without a synchronous setState inside the effect.
  const [loaded, setLoaded] = useState<{ track: TrackId; rows: LeaderboardEntry[] } | null>(null);

  const user = useAuthStore((s) => s.user);
  const initAuth = useAuthStore((s) => s.init);
  const signIn = useAuthStore((s) => s.signIn);
  useEffect(() => initAuth(), [initAuth]);

  useEffect(() => {
    let live = true;
    fetchCampaignBoard(track).then((r) => {
      if (live) setLoaded({ track, rows: r });
    });
    return () => {
      live = false;
    };
  }, [track]);

  const rows = loaded && loaded.track === track ? loaded.rows : null;

  const totalMissions = levelsForTrack(track).length;
  const podium = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];
  // Classic podium order: silver, gold, bronze — gold raised in the middle.
  const podiumDisplay = [podium[1], podium[0], podium[2]];

  return (
    <div className="lb">
      <div className="lb__tabs" role="tablist" aria-label="Campaign">
        {TRACKS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={track === t.id}
            className={`lb__tab ${track === t.id ? "lb__tab--active" : ""}`}
            onClick={() => setTrack(t.id)}
          >
            <span aria-hidden>{t.icon}</span> {t.title}
            <span className="lb__tab-cert">{t.cert}</span>
          </button>
        ))}
      </div>

      {!user && (
        <p className="lb__cta">
          🏅 Want your name up here? <button className="linklike" onClick={signIn}>Sign in</button> and
          every mission you clear climbs the board.
        </p>
      )}

      {rows === null ? (
        <p className="lb__status">Tallying the standings… 🏆</p>
      ) : rows.length === 0 ? (
        <p className="lb__status">
          No standings yet — clear a mission and you&apos;ll be the first name on the board.
        </p>
      ) : (
        <>
          <ol className="lb__podium" aria-label="Top players">
            {podiumDisplay.map((entry, i) => {
              if (!entry) return <li key={`empty-${i}`} className="lb__podium-slot lb__podium-slot--empty" aria-hidden />;
              const rank = rows.indexOf(entry);
              const isMe = !!user && entry.uid === user.uid;
              return (
                <li
                  key={entry.uid}
                  className={`lb__podium-slot lb__podium-slot--${rank + 1} ${isMe ? "lb__podium-slot--me" : ""}`}
                >
                  <div className="lb__medal" aria-hidden>{MEDALS[rank]}</div>
                  <Avatar entry={entry} />
                  <div className="lb__podium-name">
                    {entry.displayName}
                    {isMe && <span className="lb__you">YOU</span>}
                  </div>
                  <div className="lb__podium-label">{PODIUM_LABEL[rank]}</div>
                  <div className="lb__podium-stars">⭐ {entry.totalStars}</div>
                  <div className="lb__podium-meta">
                    🚩 {entry.missionsCleared}/{totalMissions}
                    {entry.cleanClears > 0 && <> · 🎯 {entry.cleanClears} clean</>}
                  </div>
                </li>
              );
            })}
          </ol>

          {rest.length > 0 && (
            <div className="lb__table-wrap">
              <table className="lb__table">
                <thead>
                  <tr>
                    <th className="lb__num">#</th>
                    <th>Player</th>
                    <th>Stars</th>
                    <th>Cleared</th>
                    <th>Clean</th>
                    <th>Score</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((entry, i) => {
                    const rank = i + 4;
                    const isMe = !!user && entry.uid === user.uid;
                    return (
                      <tr key={entry.uid} className={isMe ? "lb__row lb__row--me" : "lb__row"}>
                        <td className="lb__num">{rank}</td>
                        <td>
                          <span className="lb__player">
                            <Avatar entry={entry} />
                            <span className="lb__player-name">
                              {entry.displayName}
                              {isMe && <span className="lb__you">YOU</span>}
                            </span>
                          </span>
                        </td>
                        <td>⭐ {entry.totalStars}</td>
                        <td>{entry.missionsCleared}/{totalMissions}</td>
                        <td>{entry.cleanClears > 0 ? `🎯 ${entry.cleanClears}` : "—"}</td>
                        <td>{entry.totalScore}</td>
                        <td>{formatTime(entry.totalTimeTicks)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="lb__foot-note">
            Ranked by ⭐ stars, then 🎯 hint-free clears, then score, then fastest in-sim time.
          </p>
        </>
      )}
    </div>
  );
}
