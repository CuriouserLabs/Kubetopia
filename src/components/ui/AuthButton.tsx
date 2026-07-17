"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

/**
 * Google sign-in for cross-device progress, shared with kubequest.org.
 * The game is fully playable signed-out — progress just stays in this
 * browser instead of following the player.
 */
export default function AuthButton({ compact = false }: { compact?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const init = useAuthStore((s) => s.init);
  const signIn = useAuthStore((s) => s.signIn);
  const signOutUser = useAuthStore((s) => s.signOutUser);

  useEffect(() => init(), [init]);

  if (loading) return <span className="auth auth--loading">…</span>;

  if (user) {
    const name = user.displayName?.split(" ")[0] ?? "signed in";
    return (
      <span className="auth">
        {user.photoURL && (
          // eslint-disable-next-line @next/next/no-img-element -- tiny avatar from Google, no optimization needed
          <img src={user.photoURL} alt="" className="auth__avatar" referrerPolicy="no-referrer" />
        )}
        {!compact && <span className="auth__name">{name}</span>}
        <button className="auth__link" onClick={signOutUser} title="Sign out (progress stays synced)">
          sign out
        </button>
      </span>
    );
  }

  return (
    <span className="auth">
      <button className="btn btn--sm" onClick={signIn} title="Sync progress with your KubeQuest account">
        {compact ? "Sign in" : "Sign in with Google"}
      </button>
      {error && <span className="auth__error">{error}</span>}
    </span>
  );
}
