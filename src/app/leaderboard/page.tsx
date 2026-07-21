import type { Metadata } from "next";
import Link from "next/link";
import AuthButton from "@/components/ui/AuthButton";
import Leaderboard from "@/components/Leaderboard";

export const metadata: Metadata = {
  title: "Campaign Leaderboards — Kubetopia",
  description:
    "See who's stabilized Kubetopia best. Public leaderboards for the CKA City Campaign and CKAD Hospital Campaign — ranked by stars, hint-free clears, score and fastest in-sim time.",
  alternates: { canonical: "/leaderboard" },
};

export default function LeaderboardPage() {
  return (
    <main className="gamefront leaderboard-page">
      <div className="gamefront__stars" aria-hidden />

      <header className="gamefront__top">
        <Link href="/" className="gamefront__back">⬅ The Gateway</Link>
        <AuthButton />
      </header>

      <section className="lb-hero">
        <div className="lb-hero__trophy" aria-hidden>🏆</div>
        <h1 className="lb-hero__title">Campaign Leaderboards</h1>
        <p className="lb-hero__sub">
          The SREs who kept Kubetopia standing — fastest, cleanest, most complete.
          Clear the campaigns and climb.
        </p>
      </section>

      <section className="lb-wrap">
        <Leaderboard initialTrack="cka" />
      </section>

      <footer className="gamefront__footer">
        <p>
          Standings update as players clear missions. Studying for the real exam?{" "}
          <a href="https://kubequest.org" rel="noopener noreferrer" target="_blank">kubequest.org</a> —
          one sign-in works for both.
        </p>
      </footer>
    </main>
  );
}
