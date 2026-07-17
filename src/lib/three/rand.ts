/**
 * Pure, deterministic pseudo-randomness for the 3D scene.
 *
 * The scene needs "random-looking" but STABLE values (smoke offsets, packet
 * wobble, per-pod phase) that don't change on every React render. Calling
 * Math.random() during render is both impure (flagged by react-hooks lint)
 * and would reshuffle visuals each frame, so we seed from a stable integer or
 * string instead.
 */

/** Deterministic value in [0, 1) from an integer seed. */
export function seeded(n: number): number {
  let t = (n + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Deterministic value in [0, 1) from a string seed (e.g. a pod uid). */
export function seededStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return seeded(h >>> 0);
}
