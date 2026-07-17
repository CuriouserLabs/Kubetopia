"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useGameStore } from "@/store/gameStore";
import NodeBuilding from "./NodeBuilding";
import Traffic from "./Traffic";
import Townsfolk from "./Townsfolk";
import {
  Bushes,
  Clouds,
  Cobblestones,
  Fountain,
  Gateway,
  Island,
  Lamps,
  Trees,
} from "./Scenery";

const GATEWAY_POS: [number, number, number] = [0, 0, 7];
const FOUNTAIN_POS: [number, number, number] = [0, 0, 1.9];

/** Lay the control plane in the middle, workers in a ring around it. */
function nodeLayout(workerCount: number): (i: number) => [number, number, number] {
  return (i: number) => {
    const angle = (i / Math.max(1, workerCount)) * Math.PI * 2 + Math.PI / workerCount;
    return [Math.cos(angle) * 5.4, 0, Math.sin(angle) * 5.4 * 0.8 - 0.8];
  };
}

function TownInner() {
  const cluster = useGameStore((s) => s.cluster);
  const happiness = useGameStore((s) => s.happiness);
  if (!cluster) return null;

  const workers = cluster.nodes.filter((n) => n.roles === "worker");
  const layout = nodeLayout(workers.length);
  const positions = new Map<string, [number, number, number]>();
  const cp = cluster.nodes.find((n) => n.roles === "control-plane");
  if (cp) positions.set(cp.name, [0, 0, -1.6]);
  workers.forEach((w, i) => positions.set(w.name, layout(i)));

  /** Rotate each house so its timbered facade looks at the plaza centre. */
  const facing = (pos: [number, number, number]): number =>
    Math.atan2(-pos[0], -(pos[2] - 0.4));

  // Buildings that currently host at least one ready pod receive traffic.
  const servingNodes = new Set(
    cluster.pods.filter((p) => p.ready && p.nodeName).map((p) => p.nodeName as string)
  );
  const targets = [...servingNodes]
    .map((n) => positions.get(n))
    .filter((p): p is [number, number, number] => !!p);

  // Ambient mood follows town happiness: warm & bright vs. cold & dim.
  const warmth = happiness / 100;

  return (
    <>
      <color attach="background" args={["#bae5fd"]} />
      <fog attach="fog" args={["#bae5fd", 24, 52]} />
      <hemisphereLight args={["#cfe8ff", "#79b06e", 0.55]} />
      <ambientLight intensity={0.35 + warmth * 0.25} color={warmth > 0.5 ? "#fff7ed" : "#cbd5e1"} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.15 + warmth * 0.55}
        color={warmth > 0.5 ? "#fffbeb" : "#94a3b8"}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <Island />
      <Cobblestones />
      <Fountain position={FOUNTAIN_POS} />
      <Lamps />
      <Trees />
      <Bushes />
      <Clouds />
      <Gateway position={GATEWAY_POS} />
      <Townsfolk happiness={happiness} />
      {cluster.nodes.map((node, i) => {
        const pos = positions.get(node.name) ?? [0, 0, 0];
        return (
          <NodeBuilding
            key={node.name}
            node={node}
            pods={cluster.pods.filter((p) => p.nodeName === node.name)}
            position={pos}
            rotationY={node.roles === "worker" ? facing(pos) : 0}
            colorIndex={i}
          />
        );
      })}
      <Traffic from={GATEWAY_POS} targets={targets} intensity={happiness / 100} />
      <OrbitControls
        enablePan={false}
        minDistance={8}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.15}
        target={[0, 1.2, 0]}
      />
    </>
  );
}

export default function ClusterScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [9, 8, 13], fov: 45 }}
      dpr={[1, 1.75]}
      style={{ position: "absolute", inset: 0 }}
    >
      <TownInner />
    </Canvas>
  );
}
