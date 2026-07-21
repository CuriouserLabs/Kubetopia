import { levelsForTrack } from "@/lib/levels";
import type { TrackId } from "@/lib/levels/types";
import type { Progress } from "@/store/gameStore";

/**
 * Campaign leaderboards are keyed by mode + track so future modes (Challenge,
 * Daily, City events) can add their own boards without colliding. Today:
 * `campaign_cka` and `campaign_ckad`.
 */
export function campaignBoardId(track: TrackId): string {
  return `campaign_${track}`;
}

/** Top-level Firestore collection holding one document per leaderboard. */
export const LEADERBOARDS_COLLECTION = "kubetopia_leaderboards";

export interface CampaignStanding {
  missionsCleared: number;
  totalStars: number;
  totalScore: number;
  totalTimeTicks: number;
  cleanClears: number;
}

/**
 * Pure aggregation: fold a player's per-mission bests (held in `progress`)
 * into their standing on a track's leaderboard. A mission counts as cleared
 * once it has earned at least one star. Kept framework-free and deterministic
 * so it can run identically on the client and (later) on a server.
 */
export function campaignStanding(track: TrackId, progress: Progress): CampaignStanding {
  const standing: CampaignStanding = {
    missionsCleared: 0,
    totalStars: 0,
    totalScore: 0,
    totalTimeTicks: 0,
    cleanClears: 0,
  };
  for (const level of levelsForTrack(track)) {
    const stars = progress.stars[level.id] ?? 0;
    if (stars <= 0) continue; // not cleared yet
    standing.missionsCleared += 1;
    standing.totalStars += stars;
    standing.totalScore += progress.bestScores[level.id] ?? 0;
    standing.totalTimeTicks += progress.bestTimes?.[level.id] ?? 0;
    if (progress.cleanClears?.[level.id]) standing.cleanClears += 1;
  }
  return standing;
}

/** The fields a leaderboard row is ranked on. */
export interface RankableStanding {
  totalStars: number;
  cleanClears: number;
  totalScore: number;
  totalTimeTicks: number;
  displayName?: string;
}

/**
 * Campaign ranking, best-first. Stars are the headline (how much of the
 * campaign you've mastered), then hint-free clears (skill), then raw score,
 * then fastest total in-sim time (lower wins — never wall-clock). A stable
 * name tiebreak keeps ordering deterministic. Pure so the same order is
 * produced on the client today and on a server later.
 */
export function compareStandings(a: RankableStanding, b: RankableStanding): number {
  if (b.totalStars !== a.totalStars) return b.totalStars - a.totalStars;
  if (b.cleanClears !== a.cleanClears) return b.cleanClears - a.cleanClears;
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  // Only players who have cleared something have time; 0 sorts last here.
  const at = a.totalTimeTicks || Number.POSITIVE_INFINITY;
  const bt = b.totalTimeTicks || Number.POSITIVE_INFINITY;
  if (at !== bt) return at - bt;
  return (a.displayName ?? "").localeCompare(b.displayName ?? "");
}
