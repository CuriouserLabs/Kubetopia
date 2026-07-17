"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { seeded } from "@/lib/three/rand";
import { toonGradient } from "@/lib/three/toon";

const ROBES = ["#b55a4e", "#4e7ab5", "#4e9b63", "#b08d2f", "#6d5ab5", "#b55a8d", "#5a8db5"];
const SKINS = ["#f2c9a0", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"];
const HATS = ["#8a5a2b", "#3f5d8a", "#6b7280", "#7a3f8a"];

/**
 * A simple cartoon face: dot eyes, brows and a mouth that flips between a
 * smile (∪) and a frown (∩) with the town's mood.
 */
function Face({ happy, scale = 1 }: { happy: boolean; scale?: number }) {
  const grad = toonGradient();
  return (
    <group scale={scale}>
      {/* eyes */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.058, 0.02, 0.128]}>
          <mesh>
            <sphereGeometry args={[0.038, 8, 8]} />
            <meshToonMaterial color="#ffffff" gradientMap={grad} />
          </mesh>
          <mesh position={[0, 0, 0.028]}>
            <sphereGeometry args={[0.017, 6, 6]} />
            <meshToonMaterial color="#2b2320" gradientMap={grad} />
          </mesh>
          {/* brow: relaxed when happy, knitted (inner ends up) when sad */}
          <mesh position={[0, 0.062, 0.012]} rotation={[0, 0, s * (happy ? -0.12 : 0.42)]}>
            <boxGeometry args={[0.062, 0.014, 0.012]} />
            <meshToonMaterial color="#3b2f24" gradientMap={grad} />
          </mesh>
        </group>
      ))}
      {/* mouth: torus half-arc — rotated PI = smile, upright = frown */}
      <mesh position={[0, happy ? -0.045 : -0.075, 0.138]} rotation={[0, 0, happy ? Math.PI : 0]}>
        <torusGeometry args={[0.045, 0.012, 6, 12, Math.PI]} />
        <meshToonMaterial color="#7a3b30" gradientMap={grad} />
      </mesh>
      {/* rosy cheeks when happy */}
      {happy &&
        [-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.1, -0.03, 0.115]}>
            <sphereGeometry args={[0.026, 6, 6]} />
            <meshToonMaterial color="#f2a3a3" gradientMap={grad} />
          </mesh>
        ))}
    </group>
  );
}

interface VillagerCfg {
  radius: number;
  speed: number;
  phase: number;
  robe: string;
  skin: string;
  hat?: string;
}

function Villager({ cfg, happy }: { cfg: VillagerCfg; happy: boolean }) {
  const group = useRef<THREE.Group>(null);
  const grad = toonGradient();

  useFrame(({ clock }) => {
    if (!group.current) return;
    const speed = happy ? cfg.speed : cfg.speed * 0.3;
    const t = clock.elapsedTime * speed + cfg.phase;
    const x = Math.cos(t) * cfg.radius;
    const z = Math.sin(t) * cfg.radius * 0.85 + 0.4;
    const bob = Math.abs(Math.sin(t * 7)) * (happy ? 0.055 : 0.015);
    group.current.position.set(x, bob, z);
    // face the walking direction (velocity of the ellipse path)
    group.current.rotation.y = Math.atan2(-Math.sin(t), Math.cos(t) * 0.85);
  });

  return (
    <group ref={group}>
      {/* robe body */}
      <mesh position={[0, 0.26, 0]} castShadow>
        <coneGeometry args={[0.2, 0.52, 8]} />
        <meshToonMaterial color={cfg.robe} gradientMap={grad} />
      </mesh>
      {/* head — hangs a little when the town is sad */}
      <group position={[0, 0.62, 0]} rotation={[happy ? 0 : 0.3, 0, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.155, 12, 12]} />
          <meshToonMaterial color={cfg.skin} gradientMap={grad} />
        </mesh>
        <Face happy={happy} />
        {cfg.hat && (
          <mesh position={[0, 0.14, 0]} castShadow>
            <coneGeometry args={[0.13, 0.2, 8]} />
            <meshToonMaterial color={cfg.hat} gradientMap={grad} />
          </mesh>
        )}
      </group>
    </group>
  );
}

/** Mayor Beatrix — top hat, sash and chain of office, waving by the fountain. */
function Mayor({ happy, position }: { happy: boolean; position: [number, number, number] }) {
  const arm = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Group>(null);
  const grad = toonGradient();

  useFrame(({ clock }) => {
    if (arm.current) {
      arm.current.rotation.z = happy
        ? 2.3 + Math.sin(clock.elapsedTime * 4) * 0.35 // enthusiastic wave
        : 0.35; // arm hanging down
    }
    if (body.current) {
      body.current.rotation.y = Math.sin(clock.elapsedTime * 0.4) * 0.35;
      body.current.position.y = Math.abs(Math.sin(clock.elapsedTime * (happy ? 2.4 : 0))) * 0.02;
    }
  });

  return (
    <group position={position}>
      <group ref={body}>
        {/* robe */}
        <mesh position={[0, 0.33, 0]} castShadow>
          <coneGeometry args={[0.26, 0.66, 10]} />
          <meshToonMaterial color="#3f4e73" gradientMap={grad} />
        </mesh>
        {/* mayoral sash */}
        <mesh position={[0, 0.42, 0.13]} rotation={[0.12, 0, 0.5]}>
          <boxGeometry args={[0.075, 0.5, 0.03]} />
          <meshToonMaterial color="#c0392b" gradientMap={grad} />
        </mesh>
        {/* chain of office */}
        <mesh position={[0, 0.55, 0.16]} rotation={[1.35, 0, 0]}>
          <torusGeometry args={[0.11, 0.018, 6, 14]} />
          <meshToonMaterial color="#d9b44a" gradientMap={grad} />
        </mesh>
        {/* waving arm */}
        <mesh ref={arm} position={[0.24, 0.52, 0]}>
          <boxGeometry args={[0.08, 0.34, 0.08]} />
          <meshToonMaterial color="#3f4e73" gradientMap={grad} />
        </mesh>
        {/* head */}
        <group position={[0, 0.82, 0]} rotation={[happy ? 0 : 0.28, 0, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.185, 12, 12]} />
            <meshToonMaterial color="#e8b48c" gradientMap={grad} />
          </mesh>
          <Face happy={happy} scale={1.2} />
          {/* grey bun peeking under the hat */}
          <mesh position={[0, 0.1, -0.12]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshToonMaterial color="#cdc6bd" gradientMap={grad} />
          </mesh>
          {/* top hat */}
          <mesh position={[0, 0.19, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.05, 12]} />
            <meshToonMaterial color="#26242a" gradientMap={grad} />
          </mesh>
          <mesh position={[0, 0.32, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.14, 0.24, 12]} />
            <meshToonMaterial color="#26242a" gradientMap={grad} />
          </mesh>
          <mesh position={[0, 0.225, 0]}>
            <cylinderGeometry args={[0.142, 0.142, 0.05, 12]} />
            <meshToonMaterial color="#c0392b" gradientMap={grad} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/**
 * The townsfolk of Kubetopia. Their stroll speed, posture and faces follow
 * the happiness meter — a downtime literally hangs heads in the plaza.
 */
export default function Townsfolk({ happiness }: { happiness: number }) {
  const happy = happiness >= 50;
  const villagers = useMemo<VillagerCfg[]>(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        radius: 1.7 + seeded(i) * 1.5,
        speed: 0.16 + seeded(i + 29) * 0.1,
        phase: seeded(i + 101) * Math.PI * 2,
        robe: ROBES[i % ROBES.length],
        skin: SKINS[i % SKINS.length],
        hat: seeded(i + 61) > 0.45 ? HATS[i % HATS.length] : undefined,
      })),
    []
  );

  return (
    <group>
      {villagers.map((cfg, i) => (
        <Villager key={i} cfg={cfg} happy={happy} />
      ))}
      <Mayor happy={happy} position={[1.35, 0, 2.6]} />
    </group>
  );
}
