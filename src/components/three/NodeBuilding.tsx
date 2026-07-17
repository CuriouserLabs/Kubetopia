"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { K8sNode, K8sPod, PodPhase } from "@/lib/k8s/types";
import { seeded, seededStr } from "@/lib/three/rand";
import { toonGradient } from "@/lib/three/toon";

/** Shutter/door accent per worker — muted, storybook-European. */
const ACCENTS = ["#4e7ab5", "#b55a4e", "#b08d2f", "#6d5ab5", "#4e9b63", "#b55a8d"];
const PLASTERS = ["#f6eedc", "#f2e7d0", "#efe9d8", "#f6ead6", "#f1ecdb", "#f7f0df"];
const TIMBER = "#5d4024";
const TIMBER_DARK = "#3f2c18";

function podColor(phase: PodPhase, ready: boolean): { color: string; pulse: boolean } {
  if (phase === "Running" && ready) return { color: "#22c55e", pulse: false };
  if (phase === "Running") return { color: "#fbbf24", pulse: true };
  if (phase === "ContainerCreating") return { color: "#38bdf8", pulse: true };
  if (phase === "Pending") return { color: "#94a3b8", pulse: true };
  if (phase === "CrashLoopBackOff") return { color: "#ef4444", pulse: true };
  if (phase === "ImagePullBackOff") return { color: "#a855f7", pulse: true };
  if (phase === "Terminating") return { color: "#6b7280", pulse: false };
  return { color: "#475569", pulse: true }; // Unknown
}

function PodCrate({ pod, position }: { pod: K8sPod; position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const { color, pulse } = podColor(pod.phase, pod.ready);
  const seed = useMemo(() => seededStr(pod.uid) * Math.PI * 2, [pod.uid]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const m = ref.current.material as THREE.MeshStandardMaterial;
    if (pulse) {
      m.emissiveIntensity = 0.75 + 0.25 * Math.sin(clock.elapsedTime * 5 + seed);
    } else {
      m.emissiveIntensity = pod.ready ? 0.55 : 0.2;
    }
    const target = pod.phase === "Terminating" ? 0.5 : 1;
    const cur = ref.current.scale.x;
    ref.current.scale.setScalar(cur + (target - cur) * 0.1);
  });

  return (
    <mesh ref={ref} position={position} castShadow>
      <boxGeometry args={[0.34, 0.34, 0.34]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.4}
        transparent={pod.phase === "Terminating"}
        opacity={pod.phase === "Terminating" ? 0.5 : 1}
      />
    </mesh>
  );
}

/* ---------------------------- disaster FX ---------------------------- */

function Smoke() {
  const group = useRef<THREE.Group>(null);
  const puffs = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        offset: i / 7,
        x: (seeded(i) - 0.5) * 0.7,
        z: (seeded(i + 17) - 0.5) * 0.7,
        speed: 0.35 + seeded(i + 43) * 0.25,
      })),
    []
  );
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.children.forEach((child, i) => {
      const p = puffs[i];
      const t = (clock.elapsedTime * p.speed + p.offset * 3) % 3;
      child.position.set(p.x + Math.sin(t * 2) * 0.15, 2.4 + t * 0.9, p.z);
      child.scale.setScalar(0.15 + t * 0.16);
      const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.opacity = Math.max(0, 0.55 * (1 - t / 3));
    });
  });
  return (
    <group ref={group}>
      {puffs.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color="#52525b" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function FireGlow() {
  const light = useRef<THREE.PointLight>(null);
  const cone = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const f = 1.6 + Math.sin(clock.elapsedTime * 13) * 0.7 + Math.sin(clock.elapsedTime * 31) * 0.4;
    if (light.current) light.current.intensity = Math.max(0.4, f);
    if (cone.current) {
      cone.current.scale.setScalar(0.85 + 0.2 * Math.sin(clock.elapsedTime * 9));
      cone.current.rotation.y = clock.elapsedTime * 2;
    }
  });
  return (
    <group position={[0, 2.45, 0]}>
      <pointLight ref={light} color="#fb923c" intensity={2} distance={5} />
      <mesh ref={cone}>
        <coneGeometry args={[0.35, 0.75, 8]} />
        <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={1.6} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

/* ------------------------- half-timbered house ------------------------ */

function TimberedHouse({
  width,
  height,
  plaster,
  accent,
  down,
}: {
  width: number;
  height: number;
  plaster: string;
  accent: string;
  down: boolean;
}) {
  const wall = down ? "#4b4a52" : plaster;
  const beam = down ? "#2c2a30" : TIMBER;
  const post = width / 2 - 0.045;
  const grad = toonGradient();
  return (
    <group>
      {/* plaster body */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, width]} />
        <meshToonMaterial color={wall} gradientMap={grad} />
      </mesh>
      {/* corner posts */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * post, height / 2, sz * post]}>
            <boxGeometry args={[0.11, height + 0.02, 0.11]} />
            <meshToonMaterial color={beam} gradientMap={grad} />
          </mesh>
        ))
      )}
      {/* horizontal timber bands */}
      {[0.06, height * 0.52, height - 0.05].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[width + 0.05, 0.08, width + 0.05]} />
          <meshToonMaterial color={beam} gradientMap={grad} />
        </mesh>
      ))}
      {/* diagonal brace on the front gable */}
      <mesh position={[-0.25 * width, height * 0.76, width / 2 + 0.015]} rotation={[0, 0, 0.55]}>
        <boxGeometry args={[0.07, height * 0.42, 0.03]} />
        <meshToonMaterial color={beam} gradientMap={grad} />
      </mesh>
      <mesh position={[0.25 * width, height * 0.76, width / 2 + 0.015]} rotation={[0, 0, -0.55]}>
        <boxGeometry args={[0.07, height * 0.42, 0.03]} />
        <meshToonMaterial color={beam} gradientMap={grad} />
      </mesh>
      {/* door */}
      <mesh position={[0, 0.34, width / 2 + 0.02]}>
        <boxGeometry args={[0.42, 0.6, 0.04]} />
        <meshToonMaterial color={down ? "#232126" : TIMBER_DARK} gradientMap={grad} />
      </mesh>
      <mesh position={[0.13, 0.34, width / 2 + 0.05]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshToonMaterial color="#d9b44a" gradientMap={grad} />
      </mesh>
      {/* upstairs windows with shutters + flower boxes */}
      {[-0.27, 0.27].map((fx) => (
        <group key={fx} position={[fx * width, height * 0.68, width / 2 + 0.02]}>
          <mesh>
            <boxGeometry args={[0.3, 0.34, 0.03]} />
            <meshToonMaterial color="#fbf7ec" gradientMap={grad} />
          </mesh>
          <mesh position={[0, 0, 0.012]}>
            <boxGeometry args={[0.22, 0.26, 0.02]} />
            <meshStandardMaterial
              color={down ? "#26252b" : "#ffe9a8"}
              emissive={down ? "#000000" : "#fbbf24"}
              emissiveIntensity={down ? 0 : 0.55}
            />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.21, 0, 0.005]}>
              <boxGeometry args={[0.09, 0.34, 0.02]} />
              <meshToonMaterial color={down ? "#39373f" : accent} gradientMap={grad} />
            </mesh>
          ))}
          <mesh position={[0, -0.23, 0.05]}>
            <boxGeometry args={[0.34, 0.07, 0.09]} />
            <meshToonMaterial color={down ? "#39373f" : "#3f9e58"} gradientMap={grad} />
          </mesh>
          {!down &&
            [-0.1, 0, 0.1].map((px, i) => (
              <mesh key={px} position={[px, -0.18, 0.07]}>
                <sphereGeometry args={[0.035, 6, 6]} />
                <meshToonMaterial color={["#f472b6", "#f87171", "#fbbf24"][i]} gradientMap={grad} />
              </mesh>
            ))}
        </group>
      ))}
      {/* roof — aligned pyramid with an overhang */}
      <mesh position={[0, height + 0.42, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[width * 0.82, 0.95, 4]} />
        <meshToonMaterial color={down ? "#2f2d33" : "#b8503a"} gradientMap={grad} />
      </mesh>
      {/* chimney */}
      <mesh position={[width * 0.24, height + 0.62, -width * 0.16]} castShadow>
        <boxGeometry args={[0.18, 0.5, 0.18]} />
        <meshToonMaterial color={down ? "#3a383f" : "#9b6a4a"} gradientMap={grad} />
      </mesh>
    </group>
  );
}

/* --------------------------- the clock tower -------------------------- */

function ClockTower({ down }: { down: boolean }) {
  const hourHand = useRef<THREE.Mesh>(null);
  const minuteHand = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (minuteHand.current) minuteHand.current.rotation.z = -clock.elapsedTime * 0.25;
    if (hourHand.current) hourHand.current.rotation.z = -clock.elapsedTime * 0.02 - 1.1;
  });
  const grad = toonGradient();
  const stone = down ? "#3f3e45" : "#b3aca0";
  const plaster = down ? "#4b4a52" : "#f3ecdb";
  return (
    <group>
      {/* stone base */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 1.0, 1.5]} />
        <meshToonMaterial color={stone} gradientMap={grad} />
      </mesh>
      {/* shaft */}
      <mesh position={[0, 2.1, 0]} castShadow>
        <boxGeometry args={[1.15, 2.4, 1.15]} />
        <meshToonMaterial color={plaster} gradientMap={grad} />
      </mesh>
      {/* corner trim */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.53, 2.1, sz * 0.53]}>
            <boxGeometry args={[0.1, 2.42, 0.1]} />
            <meshToonMaterial color={stone} gradientMap={grad} />
          </mesh>
        ))
      )}
      {/* clock face */}
      <group position={[0, 2.55, 0.59]}>
        <mesh>
          <cylinderGeometry args={[0.36, 0.36, 0.04, 20]} />
          <meshToonMaterial color={down ? "#26252b" : "#fbf7ec"} gradientMap={grad} />
        </mesh>
      </group>
      <group position={[0, 2.55, 0.62]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <torusGeometry args={[0.36, 0.035, 8, 24]} />
          <meshToonMaterial color={TIMBER_DARK} gradientMap={grad} />
        </mesh>
      </group>
      {!down && (
        <group position={[0, 2.55, 0.63]}>
          <mesh ref={hourHand}>
            <boxGeometry args={[0.05, 0.2, 0.015]} />
            <meshToonMaterial color="#2b2b31" gradientMap={grad} />
          </mesh>
          <mesh ref={minuteHand}>
            <boxGeometry args={[0.035, 0.3, 0.015]} />
            <meshToonMaterial color="#2b2b31" gradientMap={grad} />
          </mesh>
        </group>
      )}
      {/* belfry + spire */}
      <mesh position={[0, 3.45, 0]} castShadow>
        <boxGeometry args={[1.3, 0.3, 1.3]} />
        <meshToonMaterial color={stone} gradientMap={grad} />
      </mesh>
      <mesh position={[0, 4.15, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.0, 1.2, 4]} />
        <meshToonMaterial color={down ? "#2f2d33" : "#51618d"} gradientMap={grad} />
      </mesh>
      <mesh position={[0, 4.85, 0]}>
        <sphereGeometry args={[0.11, 8, 8]} />
        <meshStandardMaterial color="#f5cf57" emissive="#f5cf57" emissiveIntensity={down ? 0 : 0.5} />
      </mesh>
    </group>
  );
}

/* ------------------------------ NodeBuilding -------------------------- */

interface Props {
  node: K8sNode;
  pods: K8sPod[];
  position: [number, number, number];
  /** Y rotation so the facade faces the plaza. */
  rotationY?: number;
  colorIndex: number;
}

export default function NodeBuilding({ node, pods, position, rotationY = 0, colorIndex }: Props) {
  const isControlPlane = node.roles === "control-plane";
  const down = node.status === "NotReady";
  const height = 2.4;
  const width = 2.0;
  const labelHeight = isControlPlane ? 5.6 : height + 1.5;

  // Pods float in a grid beside the building, like crates on shelves.
  const podPositions: [number, number, number][] = pods.map((_, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2) % 5;
    const layer = Math.floor(i / 10);
    return [width / 2 + 0.5 + layer * 0.5, 0.45 + row * 0.48, -0.45 + col * 0.9];
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {isControlPlane ? (
        <ClockTower down={down} />
      ) : (
        <TimberedHouse
          width={width}
          height={height}
          plaster={PLASTERS[colorIndex % PLASTERS.length]}
          accent={ACCENTS[colorIndex % ACCENTS.length]}
          down={down}
        />
      )}
      {/* cordon barrier ring */}
      {node.cordoned && (
        <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[width * 0.95, width * 1.15, 24]} />
          <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
      {down && <Smoke />}
      {down && <FireGlow />}

      {pods.map((p, i) => (
        <PodCrate key={p.uid} pod={p} position={podPositions[i]} />
      ))}

      <Html position={[0, labelHeight, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <div className={`node-label ${down ? "node-label--down" : ""}`}>
          <span className="node-label__name">{node.name}</span>
          <span className="node-label__status">
            {down ? "🔥 NotReady" : node.cordoned ? "🚧 cordoned" : isControlPlane ? "🧠 control" : "✅ Ready"}
          </span>
        </div>
      </Html>
    </group>
  );
}
