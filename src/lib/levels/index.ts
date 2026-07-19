import level1 from "./level1";
import level2 from "./level2";
import level3 from "./level3";
import level4 from "./level4";
import level5 from "./level5";
import level6 from "./level6";
import level7 from "./level7";
import ckad1 from "./ckad1";
import ckad2 from "./ckad2";
import ckad3 from "./ckad3";
import ckad4 from "./ckad4";
import ckad5 from "./ckad5";
import type { LevelDef, TrackId } from "./types";

export const LEVELS: LevelDef[] = [
  level1,
  level2,
  level3,
  level4,
  level5,
  level6,
  level7,
  ckad1,
  ckad2,
  ckad3,
  ckad4,
  ckad5,
];

/** Presentation data for a campaign track. New places (districts, islands)
 *  should slot in here as new entries — pages and grids are driven by this. */
export interface TrackInfo {
  id: TrackId;
  /** URL segment under /campaign/. */
  slug: string;
  title: string;
  /** The class-select line: which kind of hero you play. */
  role: string;
  /** Exam alignment badge. */
  cert: string;
  icon: string;
  /** One punchy line for the portal card on the landing page. */
  tagline: string;
  /** Longer intro paragraph for the campaign page hero. */
  description: string;
  /** Who you'll meet — pure flavor. */
  cast: string;
  /** Skill chips on the portal card. */
  skills: string[];
}

/** Campaign tracks, in display order. */
export const TRACKS: TrackInfo[] = [
  {
    id: "cka",
    slug: "cka",
    title: "The City Campaign",
    role: "Path of the Cluster Admin",
    cert: "CKA-style",
    icon: "🏙️",
    tagline: "A floating island town runs on a cluster — and everything that can fail, will.",
    description:
      "Kubetopia's cobblestone streets run on Kubernetes: every building is a node, every glowing crate a pod. As the town's new SRE you'll debug crash-looping bakeries, drain dying nodes in a blackout, roll back cursed deploys and ration capacity through the storm of the century.",
    cast: "Starring Mayor Beatrix, Old Sal the retired SRE, and Kublet your pager-bot.",
    skills: ["debugging pods", "node failures", "rollbacks", "capacity triage", "YAML blueprints"],
  },
  {
    id: "ckad",
    slug: "ckad",
    title: "The Hospital Campaign",
    role: "Path of the App Developer",
    cert: "CKAD-style",
    icon: "🏥",
    tagline: "Kubetopia General goes digital — build and ship every app that keeps it beating.",
    description:
      "The town hospital is moving onto the cluster, and you're the developer on call. Apply blueprints for the admissions desk, wire ConfigMaps and Secrets into the pharmacy, cure Running-but-never-Ready monitors, survive your own rollout gone wrong — and hold the line when the outbreak hits.",
    cast: "Starring Dr. Iris, Devin the intern, and one extremely important gift shop.",
    skills: ["apps from YAML", "ConfigMaps & Secrets", "readiness probes", "rollouts & rollbacks", "incident response"],
  },
];

export function getTrack(slugOrId: string): TrackInfo | undefined {
  return TRACKS.find((t) => t.slug === slugOrId || t.id === slugOrId);
}

export function trackOf(level: LevelDef): TrackId {
  return level.track ?? "cka";
}

export function levelsForTrack(track: TrackId): LevelDef[] {
  return LEVELS.filter((l) => trackOf(l) === track);
}

/** 1-based position of a level within its own track (for display). */
export function missionNumber(level: LevelDef): number {
  return levelsForTrack(trackOf(level)).findIndex((l) => l.id === level.id) + 1;
}

/**
 * A mission is unlocked when it's first in its track or the previous mission
 * in the same track has been completed. Tracks unlock independently.
 * `unlocked` is the legacy linear counter for the original (city) campaign.
 */
export function isLevelUnlocked(
  level: LevelDef,
  progress: { unlocked: number; stars: Record<number, number>; bestScores: Record<number, number> }
): boolean {
  const track = levelsForTrack(trackOf(level));
  const idx = track.findIndex((l) => l.id === level.id);
  if (idx <= 0) return true;
  if (trackOf(level) === "cka" && level.id <= progress.unlocked) return true;
  const prev = track[idx - 1];
  return (progress.stars[prev.id] ?? 0) > 0 || progress.bestScores[prev.id] !== undefined;
}

export function getLevel(id: number): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function getLevelBySlug(slug: string): LevelDef | undefined {
  return LEVELS.find((l) => l.slug === slug);
}

export function maxScore(level: LevelDef): number {
  return level.objectives.reduce((s, o) => s + o.points, 0);
}
