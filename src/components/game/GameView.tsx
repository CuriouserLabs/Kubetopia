"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import HUD from "@/components/ui/HUD";
import ObjectivesPanel from "@/components/ui/ObjectivesPanel";
import Terminal from "@/components/ui/Terminal";
import StoryModal from "@/components/ui/StoryModal";
import LevelCompleteModal from "@/components/ui/LevelCompleteModal";
import Notices from "@/components/ui/Notices";
import YamlEditor from "@/components/ui/YamlEditor";

// The 3D scene touches WebGL — client only, no SSR.
const ClusterScene = dynamic(() => import("@/components/three/ClusterScene"), {
  ssr: false,
  loading: () => <div className="scene-loading">Raising the island… 🏗️</div>,
});

export default function GameView({ levelId }: { levelId: number }) {
  const startLevel = useGameStore((s) => s.startLevel);
  const stepTick = useGameStore((s) => s.stepTick);
  const exitLevel = useGameStore((s) => s.exitLevel);

  useEffect(() => {
    startLevel(levelId);
    return () => exitLevel();
  }, [levelId, startLevel, exitLevel]);

  useEffect(() => {
    const timer = setInterval(() => stepTick(), 1000);
    return () => clearInterval(timer);
  }, [stepTick]);

  return (
    <div className="game">
      <div className="game__scene">
        <ClusterScene />
        <HUD />
        <Notices />
      </div>
      <div className="game__sidebar">
        <ObjectivesPanel />
        <Terminal />
      </div>
      <StoryModal />
      <YamlEditor />
      <LevelCompleteModal />
    </div>
  );
}
