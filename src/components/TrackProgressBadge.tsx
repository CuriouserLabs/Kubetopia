"use client";

import { useSyncExternalStore } from "react";
import { levelsForTrack } from "@/lib/levels";
import type { TrackId } from "@/lib/levels/types";
import { useGameStore } from "@/store/gameStore";

const noopSubscribe = () => () => {};

function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/** Tiny save-file line on a landing-page portal: progress in that campaign. */
export default function TrackProgressBadge({ track }: { track: TrackId }) {
  const progress = useGameStore((s) => s.progress);
  const hydrated = useHydrated();
  const levels = levelsForTrack(track);
  const cleared = hydrated
    ? levels.filter((l) => (progress.stars[l.id] ?? 0) > 0).length
    : 0;
  const stars = hydrated
    ? levels.reduce((s, l) => s + (progress.stars[l.id] ?? 0), 0)
    : 0;

  if (!hydrated || cleared === 0) {
    return <span className="portal__progress portal__progress--new">✦ New game</span>;
  }
  return (
    <span className="portal__progress">
      🚩 {cleared}/{levels.length} · ⭐ {stars}
    </span>
  );
}
