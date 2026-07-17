"use client";

import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import AuthButton from "./AuthButton";

function happinessFace(h: number): string {
  if (h >= 80) return "😄";
  if (h >= 60) return "🙂";
  if (h >= 40) return "😟";
  if (h >= 20) return "😢";
  return "😱";
}

export default function HUD() {
  const level = useGameStore((s) => s.level);
  const cluster = useGameStore((s) => s.cluster);
  const score = useGameStore((s) => s.score);
  const happiness = useGameStore((s) => s.happiness);
  if (!level || !cluster) return null;

  const mins = Math.floor(cluster.tick / 60);
  const secs = cluster.tick % 60;

  return (
    <div className="hud">
      <Link href="/" className="hud__back" title="Back to level select">
        ⬅ Town Hall
      </Link>
      <div className="hud__level">
        <span className="hud__level-num">Level {level.id}</span>
        <span className="hud__level-name">{level.name}</span>
      </div>
      <div className="hud__stats">
        <div className="hud__stat" title="Mission clock">
          ⏱ {mins}:{secs.toString().padStart(2, "0")}
        </div>
        <div className="hud__stat" title="Score">
          ⭐ {score}
        </div>
        <div className="hud__stat hud__happiness" title="Town happiness — keeps services serving to keep it up">
          <span className="hud__face">{happinessFace(happiness)}</span>
          <div className="hud__meter">
            <div
              className="hud__meter-fill"
              style={{
                width: `${happiness}%`,
                background: happiness >= 60 ? "#4ade80" : happiness >= 35 ? "#fbbf24" : "#f87171",
              }}
            />
          </div>
        </div>
        <div className="hud__stat hud__auth">
          <AuthButton compact />
        </div>
      </div>
    </div>
  );
}
