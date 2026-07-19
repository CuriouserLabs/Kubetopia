import type { Cluster } from "../k8s/types";

/** Cast of recurring characters — each has a cartoon portrait in the UI. */
export type SpeakerId =
  | "kublet" // your cheerful pager-bot
  | "mayor" // Mayor Beatrix
  | "crier" // the town crier
  | "intern" // Devin the intern
  | "mentor" // Old Sal, retired SRE
  | "power" // power company crew
  | "committee" // festival committee
  | "marketing"
  | "analytics"
  | "weather" // storm watch reporter
  | "doctor" // Dr. Iris at the hospital
  | "architect" // Elowen, the town architect
  | "queen"; // the Cloud Queen

export interface StoryPage {
  text: string;
  /** Who is talking; omit for plain narration (no portrait). */
  speaker?: SpeakerId;
  title?: string;
}

export interface CommandEntry {
  raw: string;
  tick: number;
}

export interface CheckCtx {
  cluster: Cluster;
  /** Commands the player has entered this level, with the tick they ran at. */
  commands: CommandEntry[];
  tick: number;
}

export interface LevelObjective {
  id: string;
  title: string;
  /** Story-flavored description shown in the mission panel. */
  description: string;
  points: number;
  hint: string;
  check: (ctx: CheckCtx) => boolean;
}

export interface ScriptedEvent {
  atTick: number;
  /** Popup shown to the player when the event fires. */
  title?: string;
  story?: string;
  speaker?: SpeakerId;
  mutate?: (cluster: Cluster) => void;
}

/** Campaign tracks: the city missions (CKA-style ops) and the hospital
 *  missions (CKAD-style app development). Levels without a track are "cka". */
export type TrackId = "cka" | "ckad";

export interface LevelDef {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  /** Which campaign this mission belongs to; defaults to "cka". */
  track?: TrackId;
  /** Intro dialog pages shown before the level starts. */
  story: StoryPage[];
  outro: string;
  skills: string[];
  buildCluster: () => Cluster;
  objectives: LevelObjective[];
  events: ScriptedEvent[];
  /** Finishing within this many ticks earns 3 stars. */
  parTicks: number;
  /** Blueprint YAML files available to `kubectl apply -f` / `cat`. */
  files?: Record<string, string>;
}
