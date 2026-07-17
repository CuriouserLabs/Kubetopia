"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { LEVELS } from "@/lib/levels";
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

export default function LevelSelect() {
  const progress = useGameStore((s) => s.progress);
  const hydrated = useHydrated();

  return (
    <div className="levels-grid">
      {LEVELS.map((level) => {
        const unlocked = !hydrated || level.id <= progress.unlocked;
        const stars = hydrated ? (progress.stars[level.id] ?? 0) : 0;
        const best = hydrated ? progress.bestScores[level.id] : undefined;
        return (
          <div key={level.id} className={`level-card ${unlocked ? "" : "level-card--locked"}`}>
            <div className="level-card__badge">Level {level.id}</div>
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
              {unlocked ? (
                <Link href={`/play/${level.slug}`} className="btn btn--primary btn--sm">
                  Play ▸
                </Link>
              ) : (
                <span className="level-card__lock">🔒 Beat level {level.id - 1}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
