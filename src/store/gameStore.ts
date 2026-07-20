"use client";

import { create } from "zustand";
import { serviceHealth, tick as engineTick } from "@/lib/k8s/engine";
import type { Cluster } from "@/lib/k8s/types";
import { HELP_TEXT, runKubectl, type EditorRequest } from "@/lib/k8s/kubectl";
import { applyYaml, ManifestError } from "@/lib/k8s/manifest";
import { getLevel, levelsForTrack, trackOf } from "@/lib/levels";
import type { CommandEntry, LevelDef, SpeakerId } from "@/lib/levels/types";
import { saveCloudProgress } from "@/lib/firebase/progress";

export interface TerminalLine {
  kind: "cmd" | "out" | "err" | "sys";
  text: string;
}

export interface Dialog {
  title: string;
  body: string;
  speaker?: SpeakerId;
}

export interface Notice {
  id: number;
  text: string;
}

export interface Progress {
  unlocked: number;
  bestScores: Record<number, number>;
  stars: Record<number, number>;
}

const PROGRESS_KEY = "kubequest-progress-v1";

function loadProgress(): Progress {
  if (typeof window === "undefined") return { unlocked: 1, bestScores: {}, stars: {} };
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (raw) return { unlocked: 1, bestScores: {}, stars: {}, ...JSON.parse(raw) };
  } catch {
    /* corrupted progress — start fresh */
  }
  return { unlocked: 1, bestScores: {}, stars: {} };
}

function saveProgress(p: Progress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* storage full/blocked — progress just won't persist */
  }
}

/** Town happiness target (0..1): how well services are actually serving. */
function happinessTarget(cluster: Cluster): number {
  if (cluster.services.length === 0) return 1;
  let weight = 0;
  let sum = 0;
  for (const svc of cluster.services) {
    const critical = cluster.deployments.some(
      (d) => d.app === svc.selectorApp && d.critical
    );
    const w = critical ? 2 : 1;
    weight += w;
    sum += serviceHealth(cluster, svc.name) * w;
  }
  return weight === 0 ? 1 : sum / weight;
}

let noticeId = 0;

export interface EditorState extends EditorRequest {
  error?: string;
}

interface GameState {
  level: LevelDef | null;
  cluster: Cluster | null;
  commands: CommandEntry[];
  terminal: TerminalLine[];
  completed: string[];
  firedEvents: number[];
  score: number;
  happiness: number;
  dialogs: Dialog[];
  notices: Notice[];
  levelComplete: boolean;
  finalStars: number;
  timeBonus: number;
  paused: boolean;
  progress: Progress;
  /** Blueprint files available to apply/cat in the current level. */
  files: Record<string, string>;
  /** Open YAML editor modal, if any. */
  editor: EditorState | null;

  startLevel: (id: number) => void;
  stepTick: () => void;
  /** Replace progress (used by cloud-sync after sign-in). */
  adoptProgress: (p: Progress) => void;
  runCommand: (raw: string) => void;
  applyEditor: (content: string) => void;
  closeEditor: () => void;
  dismissDialog: () => void;
  expireNotice: (id: number) => void;
  exitLevel: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  level: null,
  cluster: null,
  commands: [],
  terminal: [],
  completed: [],
  firedEvents: [],
  score: 0,
  happiness: 80,
  dialogs: [],
  notices: [],
  levelComplete: false,
  finalStars: 0,
  timeBonus: 0,
  paused: true,
  progress: loadProgress(),
  files: {},
  editor: null,

  startLevel: (id) => {
    const level = getLevel(id);
    if (!level) return;
    set({
      level,
      cluster: level.buildCluster(),
      commands: [],
      terminal: [
        { kind: "sys", text: `── ${level.name} ──` },
        { kind: "sys", text: 'Type "help" for the command reference, "hint" if you get stuck.' },
      ],
      completed: [],
      firedEvents: [],
      score: 0,
      happiness: 80,
      dialogs: level.story.map((page, i) => ({
        title: page.title ?? (i === 0 ? level.name : "…"),
        body: page.text,
        speaker: page.speaker,
      })),
      notices: [],
      levelComplete: false,
      finalStars: 0,
      timeBonus: 0,
      paused: true, // unpaused when intro dialogs are dismissed
      files: { ...(level.files ?? {}) },
      editor: null,
    });
  },

  stepTick: () => {
    const s = get();
    if (!s.cluster || !s.level || s.paused || s.levelComplete) return;
    const cluster = s.cluster;
    engineTick(cluster);

    // Scripted events
    const dialogs = [...s.dialogs];
    const firedEvents = [...s.firedEvents];
    s.level.events.forEach((ev, i) => {
      if (cluster.tick >= ev.atTick && !firedEvents.includes(i)) {
        firedEvents.push(i);
        ev.mutate?.(cluster);
        if (ev.story) dialogs.push({ title: ev.title ?? "Event", body: ev.story, speaker: ev.speaker });
      }
    });

    // Objectives (sequential: an objective can only complete after all before it)
    const completed = [...s.completed];
    const notices = [...s.notices];
    let score = s.score;
    const ctx = { cluster, commands: s.commands, tick: cluster.tick };
    for (const obj of s.level.objectives) {
      if (completed.includes(obj.id)) continue;
      if (obj.check(ctx)) {
        completed.push(obj.id);
        score += obj.points;
        notices.push({ id: ++noticeId, text: `✅ ${obj.title}  (+${obj.points})` });
      }
      break; // only the first incomplete objective is evaluated
    }

    // Happiness eases toward how well services are serving
    const target = happinessTarget(cluster) * 100;
    const happiness = Math.max(0, Math.min(100, s.happiness + (target - s.happiness) * 0.08));

    // Level completion
    let levelComplete: boolean = s.levelComplete;
    let { finalStars, timeBonus, progress } = s;
    if (!levelComplete && completed.length === s.level.objectives.length) {
      levelComplete = true;
      timeBonus = Math.max(0, s.level.parTicks - cluster.tick) * 2;
      score += timeBonus;
      finalStars = cluster.tick <= s.level.parTicks ? 3 : cluster.tick <= s.level.parTicks * 1.6 ? 2 : 1;
      progress = { ...progress };
      // The legacy `unlocked` counter only tracks the original city campaign;
      // other tracks unlock from their stars/bestScores (see isLevelUnlocked).
      if (trackOf(s.level) === "cka") {
        const maxCkaId = Math.max(...levelsForTrack("cka").map((l) => l.id));
        progress.unlocked = Math.max(progress.unlocked, Math.min(maxCkaId, s.level.id + 1));
      }
      progress.bestScores = { ...progress.bestScores, [s.level.id]: Math.max(progress.bestScores[s.level.id] ?? 0, score) };
      progress.stars = { ...progress.stars, [s.level.id]: Math.max(progress.stars[s.level.id] ?? 0, finalStars) };
      saveProgress(progress);
      saveCloudProgress(progress); // no-op when signed out
    }

    set({
      cluster: { ...cluster },
      dialogs,
      firedEvents,
      completed,
      notices,
      score,
      happiness,
      levelComplete,
      finalStars,
      timeBonus,
      progress,
      paused: dialogs.length > 0 ? true : s.paused,
    });
  },

  runCommand: (raw) => {
    const s = get();
    if (!s.cluster || !s.level) return;
    const trimmed = raw.trim();
    if (!trimmed) return;

    const terminal: TerminalLine[] = [...s.terminal, { kind: "cmd", text: `$ ${trimmed}` }];

    if (trimmed === "clear") {
      set({ terminal: [] });
      return;
    }
    if (["help", "kubectl help", "kubectl --help", "k help", "k --help"].includes(trimmed)) {
      set({ terminal: [...terminal, { kind: "out", text: HELP_TEXT }] });
      return;
    }
    if (trimmed === "hint") {
      const next = s.level.objectives.find((o) => !s.completed.includes(o.id));
      set({
        terminal: [
          ...terminal,
          { kind: "sys", text: next ? `💡 ${next.hint}` : "💡 All objectives complete — enjoy the view!" },
        ],
      });
      return;
    }
    if (trimmed === "ls") {
      const names = Object.keys(s.files);
      set({
        terminal: [...terminal, { kind: "out", text: names.length > 0 ? names.join("\n") : "(no blueprint files in this mission)" }],
      });
      return;
    }
    if (trimmed.startsWith("cat ")) {
      const name = trimmed.slice(4).trim();
      const content = s.files[name];
      set({
        terminal: [
          ...terminal,
          content !== undefined
            ? { kind: "out", text: content }
            : { kind: "err", text: `cat: ${name}: No such file. Try "ls".` },
        ],
      });
      return;
    }

    const commands = [...s.commands, { raw: trimmed, tick: s.cluster.tick }];
    const result = runKubectl(s.cluster, trimmed, s.files);
    terminal.push({ kind: result.ok ? "out" : "err", text: result.output });
    if (terminal.length > 200) terminal.splice(0, terminal.length - 200);
    set({
      terminal,
      commands,
      cluster: { ...s.cluster },
      editor: result.editor ? { ...result.editor } : s.editor,
    });
  },

  applyEditor: (content) => {
    const s = get();
    if (!s.cluster || !s.editor) return;
    try {
      const output = applyYaml(s.cluster, content, s.editor.resource);
      const files = s.editor.filename ? { ...s.files, [s.editor.filename]: content } : s.files;
      set({
        cluster: { ...s.cluster },
        files,
        editor: null,
        terminal: [...s.terminal, { kind: "out", text: output }],
      });
    } catch (e) {
      if (e instanceof ManifestError) {
        set({ editor: { ...s.editor, content, error: e.message } });
      } else {
        set({ editor: { ...s.editor, content, error: "unexpected error applying manifest" } });
      }
    }
  },

  closeEditor: () => {
    const s = get();
    set({
      editor: null,
      terminal: [...s.terminal, { kind: "sys", text: "Edit cancelled — no changes applied." }],
    });
  },

  adoptProgress: (p) => {
    saveProgress(p);
    set({ progress: p });
  },

  dismissDialog: () => {
    const s = get();
    const dialogs = s.dialogs.slice(1);
    set({ dialogs, paused: dialogs.length > 0 });
  },

  expireNotice: (id) => {
    set({ notices: get().notices.filter((n) => n.id !== id) });
  },

  exitLevel: () => {
    set({
      level: null,
      cluster: null,
      paused: true,
      levelComplete: false,
      dialogs: [],
      notices: [],
    });
  },
}));
