import * as THREE from "three";

let gradient: THREE.DataTexture | null = null;

/**
 * Shared stepped-gradient texture for meshToonMaterial. Sampling light
 * intensity through a few hard bands is what gives 3D-cartoon-movie
 * cel shading — flat pools of light instead of smooth falloff.
 */
export function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    const steps = new Uint8Array([110, 160, 210, 255]);
    gradient = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}
