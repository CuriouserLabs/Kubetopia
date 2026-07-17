"use client";

import { create } from "zustand";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "@/lib/firebase/client";
import { loadCloudProgress, mergeProgress, saveCloudProgress } from "@/lib/firebase/progress";
import { useGameStore } from "./gameStore";

interface AuthState {
  user: User | null;
  /** True while the initial auth state is resolving. */
  loading: boolean;
  error: string | null;
  init: () => void;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

let initialized = false;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  /** Idempotent — call from any page that shows auth state. */
  init: () => {
    if (initialized || typeof window === "undefined") return;
    initialized = true;
    const auth = getFirebaseAuth();
    if (!auth) {
      set({ loading: false });
      return;
    }
    onAuthStateChanged(
      auth,
      async (user) => {
        set({ user, loading: false });
        if (user) {
          // Two-way sync: keep the best of local and cloud progress.
          const local = useGameStore.getState().progress;
          const cloud = await loadCloudProgress(user.uid);
          const merged = cloud ? mergeProgress(local, cloud) : local;
          useGameStore.getState().adoptProgress(merged);
          saveCloudProgress(merged);
        }
      },
      () => set({ loading: false, error: "Could not determine sign-in state." })
    );
  },

  signIn: async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    set({ error: null });
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        set({ error: "Google sign-in failed. Check pop-up blockers and try again." });
      }
    }
  },

  signOutUser: async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    try {
      await signOut(auth);
    } catch {
      set({ error: "Sign-out failed. Please try again." });
    }
  },
}));
