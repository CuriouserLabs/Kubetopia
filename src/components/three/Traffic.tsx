"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { seeded } from "@/lib/three/rand";

const MAX_PACKETS = 24;

interface Props {
  /** World position packets fly from (the gateway). */
  from: [number, number, number];
  /** Buildings currently hosting ready pods. */
  targets: [number, number, number][];
  /** 0..1 — how much of the town's traffic is being served. */
  intensity: number;
}

/**
 * Little glowing request-packets arcing from the gateway to healthy
 * buildings. Packet count scales with service health, so an outage is
 * immediately visible as the sky going quiet.
 */
export default function Traffic({ from, targets, intensity }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  // A single reusable transform object for writing instance matrices. It's a
  // scratch buffer, not render state, so it lives in a ref (mutable) rather
  // than useMemo (which lint treats as immutable).
  const dummyRef = useRef<THREE.Object3D | null>(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: MAX_PACKETS }, (_, i) => ({
        offset: (i / MAX_PACKETS) * 2,
        speed: 0.45 + (i % 5) * 0.07,
        wobble: seeded(i) * Math.PI * 2,
      })),
    []
  );

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const dummy = (dummyRef.current ??= new THREE.Object3D());
    const active = targets.length === 0 ? 0 : Math.round(MAX_PACKETS * intensity);
    const start = new THREE.Vector3(...from).add(new THREE.Vector3(0, 2.5, 0));

    for (let i = 0; i < MAX_PACKETS; i++) {
      if (i >= active) {
        dummy.position.set(0, -100, 0); // parked out of sight
      } else {
        const target = targets[i % targets.length];
        const end = new THREE.Vector3(target[0], target[1] + 1.4, target[2]);
        const t = (clock.elapsedTime * seeds[i].speed + seeds[i].offset) % 1;
        dummy.position.lerpVectors(start, end, t);
        dummy.position.y += Math.sin(t * Math.PI) * 1.6; // arc
        dummy.position.x += Math.sin(clock.elapsedTime * 2 + seeds[i].wobble) * 0.08;
      }
      dummy.scale.setScalar(0.09);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_PACKETS]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={1.2} />
    </instancedMesh>
  );
}
