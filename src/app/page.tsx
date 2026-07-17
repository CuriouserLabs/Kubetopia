import type { Metadata } from "next";
import LevelSelect from "@/components/LevelSelect";
import AuthButton from "@/components/ui/AuthButton";
import { LEVELS } from "@/lib/levels";

export const metadata: Metadata = {
  title: "Kubetopia — learn Kubernetes by saving a tiny 3D town",
  alternates: { canonical: "/" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Kubetopia",
  url: "https://play.kubequest.org",
  description:
    "An animated, browser-based Kubernetes simulator game. Practice kubectl debugging, node failure recovery, rollbacks, YAML manifests, ConfigMaps, readiness probes and capacity planning across 7 story-driven levels.",
  genre: ["Educational", "Simulation"],
  gamePlatform: "Web browser",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Any (WebGL browser)",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  educationalUse: "Kubernetes administration practice",
  isPartOf: { "@type": "WebSite", name: "KubeQuest", url: "https://kubequest.org" },
};

export default function HomePage() {
  return (
    <main className="landing">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="landing__hero">
        <div className="landing__logo">☸️</div>
        <h1 className="landing__title">Kubetopia</h1>
        <p className="landing__subtitle">
          The town of <strong>Kubetopia</strong> runs on a Kubernetes cluster — and you are its new
          SRE. Debug crash-looping pods, drain dying nodes, roll back cursed deploys, fix YAML
          blueprints and keep the townsfolk happy through seven escalating, story-driven incidents.
        </p>
        <p className="landing__subtitle landing__subtitle--small">
          Real <code>kubectl</code> commands · real failure patterns · cartoon consequences.
          No cluster needed — it all runs in your browser.
        </p>
        <div className="landing__authbar">
          <AuthButton />
          <span className="landing__crosslink">
            Studying for CKA/CKAD? Build your plan at{" "}
            <a href="https://kubequest.org" rel="noopener noreferrer">kubequest.org</a> — one
            sign-in works for both.
          </span>
        </div>
      </header>

      <section aria-labelledby="levels-heading" className="landing__levels">
        <h2 id="levels-heading" className="landing__h2">Choose your shift</h2>
        <LevelSelect />
      </section>

      <section className="landing__about">
        <h2 className="landing__h2">What you&apos;ll practice</h2>
        <div className="landing__skills">
          <div className="skill-card">
            <h3>🔍 Debugging workloads</h3>
            <p>
              Read pod states like an SRE: CrashLoopBackOff, ImagePullBackOff, Pending and Unknown —
              and the <code>describe</code>/<code>logs</code>/<code>events</code> trail that explains them.
            </p>
          </div>
          <div className="skill-card">
            <h3>🏥 Surviving node failures</h3>
            <p>
              When a node goes NotReady its pods don&apos;t move on their own. Learn the
              <code> cordon</code> → <code>drain</code> → <code>uncordon</code> cycle that real operators
              use during hardware failures.
            </p>
          </div>
          <div className="skill-card">
            <h3>⏪ Rollbacks under pressure</h3>
            <p>
              A bad release on launch day is a rite of passage. Practice <code>rollout undo</code>,
              <code> set image</code> and reading a rollout&apos;s status while the clock ticks.
            </p>
          </div>
          <div className="skill-card">
            <h3>📐 Capacity & triage</h3>
            <p>
              Resource requests are promises. When capacity halves in a storm, do the math, scale the
              arcade down and keep the hospital up.
            </p>
          </div>
          <div className="skill-card">
            <h3>📜 YAML manifests</h3>
            <p>
              Apply blueprints with <code>kubectl apply -f</code>, meet the API server&apos;s real
              validation errors — string replicas, selector/label mismatches — and fix them in a live
              YAML editor.
            </p>
          </div>
          <div className="skill-card">
            <h3>🎛️ Config & readiness</h3>
            <p>
              The two great mysteries of production: pods that crash for a missing ConfigMap key, and
              pods that are Running yet never Ready because the probe knocks on the wrong port.
            </p>
          </div>
        </div>
      </section>

      <section className="landing__about">
        <h2 className="landing__h2">The campaign</h2>
        <ol className="landing__campaign">
          {LEVELS.map((l) => (
            <li key={l.id}>
              <strong>{l.name}</strong> — {l.tagline}
            </li>
          ))}
        </ol>
      </section>

      <footer className="landing__footer">
        <p>
          Kubetopia is a learning simulator: the cluster is simulated, the incidents are real-world
          patterns. Part of{" "}
          <a href="https://kubequest.org" rel="noopener noreferrer">KubeQuest</a> — pairs well with
          the official{" "}
          <a href="https://kubernetes.io/docs/home/" rel="noopener noreferrer" target="_blank">
            Kubernetes documentation
          </a>.
        </p>
      </footer>
    </main>
  );
}
