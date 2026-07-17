import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "./client";
import type { Progress } from "@/store/gameStore";

/**
 * Cloud save for Kubetopia. Lives in its own top-level collection
 * (`kubetopia/{uid}`) so it can never collide with KubeQuest's study-plan
 * data in `users/{uid}` — both apps share the Firebase project.
 */
const COLLECTION = "kubetopia";

export function mergeProgress(a: Progress, b: Progress): Progress {
  const merged: Progress = {
    unlocked: Math.max(a.unlocked, b.unlocked),
    bestScores: { ...a.bestScores },
    stars: { ...a.stars },
  };
  for (const [k, v] of Object.entries(b.bestScores)) {
    const key = Number(k);
    merged.bestScores[key] = Math.max(merged.bestScores[key] ?? 0, v);
  }
  for (const [k, v] of Object.entries(b.stars)) {
    const key = Number(k);
    merged.stars[key] = Math.max(merged.stars[key] ?? 0, v);
  }
  return merged;
}

export async function loadCloudProgress(uid: string): Promise<Progress | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, COLLECTION, uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      unlocked: typeof d.unlocked === "number" ? d.unlocked : 1,
      bestScores: d.bestScores ?? {},
      stars: d.stars ?? {},
    };
  } catch {
    return null; // offline / rules not deployed yet — play continues locally
  }
}

/** Fire-and-forget save; only writes when someone is signed in. */
export function saveCloudProgress(progress: Progress): void {
  const auth = getFirebaseAuth();
  const db = getDb();
  const uid = auth?.currentUser?.uid;
  if (!db || !uid) return;
  setDoc(
    doc(db, COLLECTION, uid),
    { ...progress, updatedAt: serverTimestamp() },
    { merge: true }
  ).catch(() => {
    /* offline or rules missing — local progress still saved */
  });
}
