"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
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

/* ------------------------- resizable sidebar -------------------------- */

const SIDEBAR_KEY = "kubetopia-sidebar-w";
const SIDEBAR_DEFAULT = 400;
const SIDEBAR_MIN = 340;

/** Keep the console usable but never let it swallow the town. */
function clampSidebar(w: number): number {
  const max = Math.max(SIDEBAR_MIN, Math.min(Math.round(window.innerWidth * 0.6), 900));
  return Math.max(SIDEBAR_MIN, Math.min(max, Math.round(w)));
}

function useSidebarWidth() {
  const [width, setWidth] = useState(SIDEBAR_DEFAULT);
  const [dragging, setDragging] = useState(false);
  // Pointer events can arrive before React re-renders with `dragging: true`
  // (fast drags, synthetic input) — gate the move handler on a ref instead.
  const draggingRef = useRef(false);

  // Restore the saved width after mount (SSR-safe), re-clamp on window resize.
  // setTimeout rather than rAF: rAF never fires in a backgrounded tab.
  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = Number(window.localStorage.getItem(SIDEBAR_KEY));
      if (saved > 0) setWidth(clampSidebar(saved));
    }, 0);
    const onResize = () => setWidth((w) => clampSidebar(w));
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const persist = (w: number) => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, String(w));
    } catch {
      /* storage blocked — width just won't persist */
    }
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    // Sidebar sits on the right: its width is the distance to the right edge.
    setWidth(clampSidebar(window.innerWidth - e.clientX));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    draggingRef.current = false;
    setDragging(false);
    setWidth((w) => {
      persist(w);
      return w;
    });
  }, []);

  const onDoubleClick = useCallback(() => {
    setWidth(clampSidebar(SIDEBAR_DEFAULT));
    persist(SIDEBAR_DEFAULT);
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 24;
    // Left arrow grows the console (moves the divider left), right shrinks it.
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setWidth((w) => {
        const next = clampSidebar(w + (e.key === "ArrowLeft" ? step : -step));
        persist(next);
        return next;
      });
    }
  }, []);

  return { width, dragging, handlers: { onPointerDown, onPointerMove, onPointerUp, onDoubleClick, onKeyDown } };
}

export default function GameView({ levelId }: { levelId: number }) {
  const startLevel = useGameStore((s) => s.startLevel);
  const stepTick = useGameStore((s) => s.stepTick);
  const exitLevel = useGameStore((s) => s.exitLevel);
  const { width, dragging, handlers } = useSidebarWidth();
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startLevel(levelId);
    return () => exitLevel();
  }, [levelId, startLevel, exitLevel]);

  useEffect(() => {
    const timer = setInterval(() => stepTick(), 1000);
    return () => clearInterval(timer);
  }, [stepTick]);

  return (
    <div className="game" style={{ "--sidebar-w": `${width}px` } as React.CSSProperties}>
      <div className="game__scene" ref={sceneRef}>
        <ClusterScene />
        <HUD />
        <Notices />
        {/* While dragging, keep pointer events off the WebGL canvas so the
            camera doesn't fight the resize. */}
        {dragging && <div className="game__drag-shield" />}
      </div>
      <div
        className={`game__resizer ${dragging ? "game__resizer--active" : ""}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the console panel (drag, or use arrow keys; double-click to reset)"
        tabIndex={0}
        {...handlers}
      />
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
