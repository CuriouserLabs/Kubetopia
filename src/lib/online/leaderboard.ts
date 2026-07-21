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
