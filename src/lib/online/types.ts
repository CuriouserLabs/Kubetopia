import type { TrackId } from "@/lib/levels/types";

/**
 * Online data contracts for Kubetopia's campaign tracking + leaderboards.
 *
 * These types describe what the client writes to Firestore. Today campaign
 * runs are client-attested (the player is trusted). The competitive online
 * modes on the roadmap (Challenge / Daily / City events) will add server-side
 * replay verification before their scores count — see FUTURE_DEVELOPMENT_PLAN.
 */

/** A single kubectl command as entered, with the sim tick it ran on.
 *  Kept so a future server can replay the run to verify its score. */
export interface LoggedCommand {
  raw: string;
  tick: number;
}

/**
 * One completed campaign mission attempt, appended immutably to the player's
 * run history at `kubetopia_campaign_runs/{uid}/runs/{runId}`.
 */
export interface CampaignRun {
  track: TrackId;
  levelId: number;
  levelSlug: string;
  /** 1-based mission number within the track (denormalised for display). */
  missionNumber: number;
  /** Objective points + time bonus — the mission's final marks. */
  score: number;
  stars: number;
  /** In-simulation ticks used (device- and tab-throttle-independent). */
  timeTicks: number;
  /** How many times the player asked for a hint this run. */
  hintsUsed: number;
  /** Convenience flag: did they clear it without a single hint? */
  cleanClear: boolean;
  /** Replayable command log (bounded — campaign missions are short). */
  commandLog: LoggedCommand[];
}

/**
 * A player's aggregate standing on one campaign leaderboard, stored at
 * `kubetopia_leaderboards/{boardId}/entries/{uid}`. Denormalised name/photo
 * so the public board renders without a second read per row. Recomputed from
 * the player's per-mission bests on every mission completion, so it always
 * reflects their best-ever performance in that track.
 */
export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string | null;
  track: TrackId;
  /** Missions with at least one star. */
  missionsCleared: number;
  totalStars: number;
  /** Sum of best score per cleared mission. */
  totalScore: number;
  /** Sum of fastest ticks per cleared mission (lower is better). */
  totalTimeTicks: number;
  /** Missions cleared at least once without any hints. */
  cleanClears: number;
}
