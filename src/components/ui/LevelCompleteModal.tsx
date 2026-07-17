"use client";

import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { LEVELS, maxScore } from "@/lib/levels";

export default function LevelCompleteModal() {
  const level = useGameStore((s) => s.level);
  const levelComplete = useGameStore((s) => s.levelComplete);
  const score = useGameStore((s) => s.score);
  const timeBonus = useGameStore((s) => s.timeBonus);
  const stars = useGameStore((s) => s.finalStars);
  const cluster = useGameStore((s) => s.cluster);
  const startLevel = useGameStore((s) => s.startLevel);
  if (!level || !levelComplete || !cluster) return null;

  const next = LEVELS.find((l) => l.id === level.id + 1);
  const mins = Math.floor(cluster.tick / 60);
  const secs = cluster.tick % 60;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="story-card story-card--victory">
        <div className="story-card__stars" aria-label={`${stars} of 3 stars`}>
          {[1, 2, 3].map((i) => (
            <span key={i} className={i <= stars ? "star star--lit" : "star"}>★</span>
          ))}
        </div>
        <h3 className="story-card__title">Level {level.id} complete!</h3>
        <p className="story-card__body">{level.outro}</p>
        <div className="story-card__scores">
          <div>Objectives: <strong>{score - timeBonus}</strong> / {maxScore(level)}</div>
          <div>Time bonus: <strong>+{timeBonus}</strong> ({mins}:{secs.toString().padStart(2, "0")})</div>
          <div className="story-card__total">Total: <strong>{score}</strong></div>
        </div>
        <div className="story-card__actions">
          <button className="btn" onClick={() => startLevel(level.id)}>↻ Replay</button>
          {next ? (
            <Link className="btn btn--primary" href={`/play/${next.slug}`}>
              Next: {next.name} ▸
            </Link>
          ) : (
            <Link className="btn btn--primary" href="/">🏆 You beat Kubetopia!</Link>
          )}
        </div>
      </div>
    </div>
  );
}
