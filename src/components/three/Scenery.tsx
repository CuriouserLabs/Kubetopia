"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { seeded } from "@/lib/three/rand";
import { toonGradient } from "@/lib/three/toon";

/* ------------------------------------------------------------------ */
/* The floating island                                                 */
/* ------------------------------------------------------------------ */

export function Island() {
  return (
    <group>
      {/* grass top */}
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <cylinderGeometry args={[10, 9.4, 0.6, 40]} />
        <meshToonMaterial color="#8fd694" gradientMap={toonGradient()} />
      </mesh>
      {/* dirt underside */}
      <mesh position={[0, -1.8, 0]}>
        <cylinderGeometry args={[9.4, 4.5, 2.6, 40]} />
        <meshToonMaterial color="#a1682e" gradientMap={toonGradient()} />
      </mesh>
      <mesh position={[0, -3.6, 0]}>
        <coneGeometry args={[4.5, 3, 24]} />
        <meshToonMaterial color="#7c4c1e" gradientMap={toonGradient()} />
      </mesh>
      {/* packed-earth base under the plaza cobbles */}
      <mesh position={[0, 0.005, 0.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[3.6, 40]} />
        <meshToonMaterial color="#8a8178" gradientMap={toonGradient()} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Cobblestones — one instanced mesh for the plaza + the ring street   */
/* ------------------------------------------------------------------ */

const PLAZA_STONES = 190;
const STREET_STONES = 230;
const STONE_COUNT = PLAZA_STONES + STREET_STONES;

export function Cobblestones() {
  const mesh = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const inst = mesh.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < STONE_COUNT; i++) {
      let x: number;
      let z: number;
      if (i < PLAZA_STONES) {
        // plaza disc around the fountain (centre pushed toward the gateway)
        const r = 1.05 + Math.sqrt(seeded(i)) * 2.45;
        const a = seeded(i + 991) * Math.PI * 2;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r + 0.4;
      } else {
        // ring street the buildings stand on
        const a = seeded(i + 337) * Math.PI * 2;
        const r = 4.6 + seeded(i + 733) * 1.7;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r * 0.8 - 0.8;
      }
      const s = 0.15 + seeded(i + 55) * 0.12;
      dummy.position.set(x, 0.035, z);
      dummy.rotation.set(0, seeded(i + 13) * Math.PI, 0);
      dummy.scale.set(s, s * 0.35, s * (0.8 + seeded(i + 77) * 0.5));
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      // warm grey-tan shade variation
      const t = seeded(i + 211);
      color.setRGB(0.62 + t * 0.16, 0.59 + t * 0.15, 0.55 + t * 0.14);
      inst.setColorAt(i, color);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, STONE_COUNT]} receiveShadow>
      <sphereGeometry args={[1, 6, 5]} />
      <meshToonMaterial gradientMap={toonGradient()} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/* Town fountain                                                       */
/* ------------------------------------------------------------------ */

export function Fountain({ position }: { position: [number, number, number] }) {
  const water = useRef<THREE.Mesh>(null);
  const drops = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (water.current) {
      water.current.position.y = 0.24 + Math.sin(clock.elapsedTime * 2.2) * 0.012;
    }
    if (drops.current) {
      drops.current.rotation.y = clock.elapsedTime * 0.9;
      drops.current.children.forEach((d, i) => {
        d.position.y = 0.62 + Math.abs(Math.sin(clock.elapsedTime * 2.4 + i)) * 0.22;
      });
    }
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.13, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.78, 0.86, 0.26, 14]} />
        <meshToonMaterial color="#aca498" gradientMap={toonGradient()} />
      </mesh>
      <mesh ref={water} position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.66, 0.66, 0.06, 14]} />
        <meshStandardMaterial color="#6cc3e8" emissive="#38bdf8" emissiveIntensity={0.25} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 0.45, 8]} />
        <meshToonMaterial color="#b5ada1" gradientMap={toonGradient()} />
      </mesh>
      <mesh position={[0, 0.68, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.32, 0.09, 12]} />
        <meshToonMaterial color="#aca498" gradientMap={toonGradient()} />
      </mesh>
      <group ref={drops}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.42, 0.7, Math.sin((i / 5) * Math.PI * 2) * 0.42]}>
            <sphereGeometry args={[0.045, 6, 6]} />
            <meshStandardMaterial color="#a5ddf5" emissive="#7dd3fc" emissiveIntensity={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Lamp posts around the plaza                                         */
/* ------------------------------------------------------------------ */

function Lamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 1.1, 6]} />
        <meshToonMaterial color="#3b3a3e" gradientMap={toonGradient()} />
      </mesh>
      <mesh position={[0, 1.18, 0]}>
        <boxGeometry args={[0.17, 0.2, 0.17]} />
        <meshStandardMaterial color="#ffe9a8" emissive="#fbbf24" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, 1.33, 0]} castShadow>
        <coneGeometry args={[0.15, 0.14, 4]} />
        <meshToonMaterial color="#3b3a3e" gradientMap={toonGradient()} />
      </mesh>
    </group>
  );
}

const LAMP_ANGLES = [0.5, 1.75, 3.0, 4.25, 5.5];

export function Lamps() {
  return (
    <>
      {LAMP_ANGLES.map((a, i) => (
        <Lamp key={i} position={[Math.cos(a) * 3.35, 0, Math.sin(a) * 3.35 + 0.4]} />
      ))}
      {/* one shared warm light so lanterns feel lit without 5 real lights */}
      <pointLight position={[0, 2.2, 0.4]} color="#ffd9a0" intensity={18} distance={9} decay={2} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Trees, bushes, clouds                                               */
/* ------------------------------------------------------------------ */

export function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.14, 0.6, 6]} />
        <meshToonMaterial color="#7a4a21" gradientMap={toonGradient()} />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <coneGeometry args={[0.55, 0.9, 7]} />
        <meshToonMaterial color="#2e8b46" gradientMap={toonGradient()} />
      </mesh>
      <mesh position={[0, 1.42, 0]} castShadow>
        <coneGeometry args={[0.4, 0.75, 7]} />
        <meshToonMaterial color="#37a052" gradientMap={toonGradient()} />
      </mesh>
    </group>
  );
}

const TREE_SPOTS: [number, number, number][] = [
  [7.6, 0, 2.2], [-7.9, 0, 1.4], [6.8, 0, -4.4], [-6.2, 0, -5.3],
  [2.5, 0, 8.3], [-3.3, 0, 7.9], [8.4, 0, -1.2], [-8.2, 0, -2.6],
];

export function Trees() {
  return (
    <>
      {TREE_SPOTS.map((p, i) => (
        <Tree key={i} position={p} scale={0.8 + (i % 3) * 0.25} />
      ))}
    </>
  );
}

const BUSH_SPOTS: [number, number, number][] = [
  [4.1, 0, 4.6], [-4.4, 0, 4.3], [5.9, 0, 1.9], [-6.3, 0, -1.6], [1.2, 0, -6.6], [-1.8, 0, 6.9],
];
const FLOWER_COLORS = ["#f472b6", "#fbbf24", "#f87171", "#c4b5fd"];

export function Bushes() {
  return (
    <>
      {BUSH_SPOTS.map((p, i) => (
        <group key={i} position={p}>
          <mesh position={[0, 0.16, 0]} castShadow>
            <sphereGeometry args={[0.28, 8, 7]} />
            <meshToonMaterial color="#3f9e58" gradientMap={toonGradient()} />
          </mesh>
          {[0, 1, 2].map((j) => (
            <mesh
              key={j}
              position={[
                (seeded(i * 7 + j) - 0.5) * 0.4,
                0.32 + seeded(i + j + 31) * 0.08,
                (seeded(i * 11 + j + 5) - 0.5) * 0.4,
              ]}
            >
              <sphereGeometry args={[0.05, 6, 6]} />
              <meshToonMaterial color={FLOWER_COLORS[(i + j) % FLOWER_COLORS.length]} gradientMap={toonGradient()} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function CloudPuff({ position, speed }: { position: [number, number, number]; speed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const angle = clock.elapsedTime * speed;
    ref.current.position.x = position[0] * Math.cos(angle) - position[2] * Math.sin(angle);
    ref.current.position.z = position[0] * Math.sin(angle) + position[2] * Math.cos(angle);
  });
  return (
    <group ref={ref} position={position}>
      <mesh><sphereGeometry args={[0.9, 10, 10]} /><meshStandardMaterial color="white" transparent opacity={0.85} /></mesh>
      <mesh position={[0.8, -0.1, 0.2]}><sphereGeometry args={[0.6, 10, 10]} /><meshStandardMaterial color="white" transparent opacity={0.85} /></mesh>
      <mesh position={[-0.75, -0.15, -0.1]}><sphereGeometry args={[0.55, 10, 10]} /><meshStandardMaterial color="white" transparent opacity={0.85} /></mesh>
    </group>
  );
}

export function Clouds() {
  const clouds = useMemo(
    () => [
      { position: [11, 6.5, 2] as [number, number, number], speed: 0.02 },
      { position: [-9, 7.5, -6] as [number, number, number], speed: 0.015 },
      { position: [4, 8.2, -11] as [number, number, number], speed: 0.025 },
      { position: [-12, 5.8, 7] as [number, number, number], speed: 0.018 },
    ],
    []
  );
  return (
    <>
      {clouds.map((c, i) => (
        <CloudPuff key={i} {...c} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The gateway — a little stone town gate where traffic enters         */
/* ------------------------------------------------------------------ */

export function Gateway({ position }: { position: [number, number, number] }) {
  const beacon = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (beacon.current) {
      beacon.current.rotation.y = clock.elapsedTime * 1.5;
      (beacon.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.8 + 0.4 * Math.sin(clock.elapsedTime * 3);
    }
  });
  return (
    <group position={position}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.72, 2.2, 8]} />
        <meshToonMaterial color="#a8a091" gradientMap={toonGradient()} />
      </mesh>
      {/* stone bands */}
      {[0.35, 1.05, 1.75].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.66 - y * 0.08, 0.68 - y * 0.08, 0.09, 8]} />
          <meshToonMaterial color="#8d857a" gradientMap={toonGradient()} />
        </mesh>
      ))}
      {/* battlement rim */}
      <mesh position={[0, 2.26, 0]} castShadow>
        <cylinderGeometry args={[0.6, 0.5, 0.18, 8]} />
        <meshToonMaterial color="#8d857a" gradientMap={toonGradient()} />
      </mesh>
      {/* pennant */}
      <mesh position={[0, 3.05, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.9, 5]} />
        <meshToonMaterial color="#5b5650" gradientMap={toonGradient()} />
      </mesh>
      <mesh position={[0.18, 3.32, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.09, 0.34, 3]} />
        <meshToonMaterial color="#326ce5" gradientMap={toonGradient()} />
      </mesh>
      <mesh ref={beacon} position={[0, 2.62, 0]} castShadow>
        <octahedronGeometry args={[0.4]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1} />
      </mesh>
    </group>
  );
}
