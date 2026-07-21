import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type { TrackId } from "@/lib/levels/types";
import { campaignBoardId, compareStandings, LEADERBOARDS_COLLECTION } from "./leaderboard";
import type { LeaderboardEntry } from "./types";

/** How many rows a public board fetches. Bounded so reads stay O(N), and the
 *  campaign is finite anyway — nobody scrolls past a couple hundred names. */
const BOARD_LIMIT = 200;

/**
 * Public read of a campaign leaderboard. Anyone (signed in or not) can call
 * it. Firestore orders by the headline metric (stars) to bound the fetch;
 * the full tiebreak ordering is applied in-memory by `compareStandings` so
 * the displayed rank matches the ranking rules exactly.
 *
 * Returns `[]` when Firestore is unreachable or the board is empty — the page
 * shows an empty/offline state rather than failing.
 */
export async function fetchCampaignBoard(track: TrackId): Promise<LeaderboardEntry[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const entries = collection(db, LEADERBOARDS_COLLECTION, campaignBoardId(track), "entries");
    const snap = await getDocs(query(entries, orderBy("totalStars", "desc"), limit(BOARD_LIMIT)));
    const rows = snap.docs.map((d) => d.data() as LeaderboardEntry);
    return rows.sort(compareStandings);
  } catch {
    return [];
  }
}
