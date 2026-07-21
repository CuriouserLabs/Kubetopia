import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDb, getFirebaseAuth } from "@/lib/firebase/client";
import { missionNumber, trackOf } from "@/lib/levels";
import type { LevelDef } from "@/lib/levels/types";
import type { Progress } from "@/store/gameStore";
import { campaignBoardId, campaignStanding, LEADERBOARDS_COLLECTION } from "./leaderboard";
import type { CampaignRun, LeaderboardEntry, LoggedCommand } from "./types";

/** Per-player run history. Subcollection so a player owns their whole subtree
 *  in the security rules: `kubetopia_campaign_runs/{uid}/runs/{runId}`. */
const RUNS_COLLECTION = "kubetopia_campaign_runs";

/** Never let a pathological run bloat a Firestore document. */
const MAX_LOGGED_COMMANDS = 500;

export interface CampaignRunInput {
  level: LevelDef;
  score: number;
  stars: number;
  timeTicks: number;
  hintsUsed: number;
  commandLog: LoggedCommand[];
  /** The player's progress AFTER this mission was folded in. */
  progress: Progress;
}

/**
 * Fire-and-forget: record a completed campaign mission and refresh the
 * player's leaderboard standing. No-op when signed out (the first mission is
 * playable without an account and simply isn't tracked) or when Firestore is
 * unreachable — local progress is already saved by the caller.
 */
export function recordCampaignRun(input: CampaignRunInput): void {
  const uid = getFirebaseAuth()?.currentUser?.uid;
  const user = getFirebaseAuth()?.currentUser;
  const db = getDb();
  if (!db || !uid || !user) return;

  const { level, score, stars, timeTicks, hintsUsed, commandLog, progress } = input;
  const track = trackOf(level);

  const run: CampaignRun & { completedAt: unknown } = {
    track,
    levelId: level.id,
    levelSlug: level.slug,
    missionNumber: missionNumber(level),
    score,
    stars,
    timeTicks,
    hintsUsed,
    cleanClear: hintsUsed === 0,
    commandLog: commandLog.slice(0, MAX_LOGGED_COMMANDS),
    completedAt: serverTimestamp(),
  };

  // 1) Append the immutable run to the player's history.
  addDoc(collection(db, RUNS_COLLECTION, uid, "runs"), run).catch(() => {
    /* offline or rules missing — local progress still saved */
  });

  // 2) Recompute and upsert the player's leaderboard standing for this track.
  const standing = campaignStanding(track, progress);
  const entry: LeaderboardEntry & { updatedAt: unknown } = {
    uid,
    displayName: user.displayName ?? "Anonymous SRE",
    photoURL: user.photoURL ?? null,
    track,
    ...standing,
    updatedAt: serverTimestamp(),
  };
  setDoc(
    doc(db, LEADERBOARDS_COLLECTION, campaignBoardId(track), "entries", uid),
    entry,
    { merge: true }
  ).catch(() => {
    /* offline or rules missing — standing will refresh on the next clear */
  });
}
