"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { isLevelUnlocked, levelsForTrack, missionNumber, requiresAuth } from "@/lib/levels";
import type { TrackId } from "@/lib/levels/types";
import { useAuthStore } from "@/store/authStore";
import { useGameStore } from "@/store/gameStore";

const noopSubscribe = () => () => {};

/** False during SSR and the first client render, true afterwards — lets us
 *  reveal localStorage-based locks without risking a hydration mismatch. */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/** The mission cards for one campaign, plus a progress ribbon. */
export default function MissionGrid({ track }: { track: TrackId }) {
  const progress = useGameStore((s) => s.progress);
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const initAuth = useAuthStore((s) => s.init);
  const signIn = useAuthStore((s) => s.signIn);
  const hydrated = useHydrated();
  const levels = levelsForTrack(track);

  useEffect(() => initAuth(), [initAuth]);

  const starsEarned = hydrated
    ? levels.reduce((s, l) => s + (progress.stars[l.id] ?? 0), 0)
    : 0;
  const cleared = hydrated
    ? levels.filter((l) => (progress.stars[l.id] ?? 0) > 0).length
    : 0;

  // Only lock on auth once we actually know the player is signed out — never
  // during SSR / first paint, and never while auth is still resolving.
  const signedOut = hydrated && !authLoading && !user;

  return (
    <div className="missions">
      <div className="missions__ribbon">
        <span className="missions__ribbon-stat">
          🚩 {cleared} / {levels.length} missions cleared
        </span>
        <span className="missions__ribbon-stat">
          ⭐ {starsEarned} / {levels.length * 3} stars
        </span>
      </div>
      {signedOut && (
        <p className="missions__signin-note">
          🔓 Mission 1 is free to try. <button className="linklike" onClick={signIn}>Sign in</button> to
          play the rest and track your marks, times and streaks.
        </p>
      )}
      <div className="levels-grid">
        {levels.map((level) => {
          const unlocked = !hydrated || isLevelUnlocked(level, progress);
          const authLocked = signedOut && requiresAuth(level);
          const stars = hydrated ? (progress.stars[level.id] ?? 0) : 0;
          const best = hydrated ? progress.bestScores[level.id] : undefined;
          const n = missionNumber(level);
          const locked = authLocked || !unlocked;
          return (
            <div key={level.id} className={`level-card ${locked ? "level-card--locked" : ""}`}>
              <div className="level-card__badge">Mission {n}</div>
              <h3 className="level-card__name">{level.name}</h3>
              <p className="level-card__tagline">{level.tagline}</p>
              <ul className="level-card__skills">
                {level.skills.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <div className="level-card__footer">
                <span className="level-card__stars">
                  {[1, 2, 3].map((i) => (
                    <span key={i} className={i <= stars ? "star star--lit" : "star"}>★</span>
                  ))}
                  {best !== undefined && <span className="level-card__best">best {best}</span>}
                </span>
                {authLocked ? (
                  <button className="btn btn--sm level-card__signin" onClick={signIn}>
                    🔐 Sign in to play
                  </button>
                ) : unlocked ? (
                  <Link href={`/play/${level.slug}`} className="btn btn--primary btn--sm">
                    Play ▸
                  </Link>
                ) : (
                  <span className="level-card__lock">🔒 Beat mission {n - 1}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
