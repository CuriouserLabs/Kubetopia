import { emptyCluster, makeDeployment, makeNode } from "../k8s/engine";
import { deploymentHealthy, noPendingPods, ranCommand } from "./helpers";
import type { LevelDef } from "./types";

const QUEEN_ARRIVES_AT = 150;

/**
 * Level 7 — the finale, part two: configuration & health checks.
 * A ConfigMap missing the key an app needs (CrashLoop with a config error)
 * and a readiness probe pointed at the wrong port (Running but never Ready)
 * — the two most confusing "but it deployed fine!" incidents in real life.
 */
const level7: LevelDef = {
  id: 7,
  slug: "the-cloud-queens-inspection",
  name: "The Cloud Queen's Inspection",
  tagline: "Everything is Running. Nothing is Ready. Royalty is at the gates.",
  skills: ["ConfigMaps & app configuration", "readiness probes", "kubectl edit on live resources"],
  story: [
    {
      speaker: "mayor",
      text: "Protocol emergency! The CLOUD QUEEN is coming to certify Kubetopia as a Well-Architected Town. Royal banners on every lamp post, the Welcome Hall polished — everything must be READY. Capital R.",
    },
    {
      speaker: "intern",
      text: "So, um. I prepared the royal theme in a ConfigMap like you taught me? But the banner pods keep crashing. And the Welcome Hall says Running but the gate keeps showing 0/1 Ready and I don't understand the difference and I've had four coffees.",
    },
    {
      speaker: "mentor",
      text: "Two different diseases, kid. A pod that CRASHES is usually missing something it needs at startup — read its logs, it'll tell you which config key. A pod that runs but never goes READY has a failing readiness probe — describe it and compare the probe's port with the port the container actually listens on. `kubectl edit` fixes both without touching a single file.",
    },
  ],
  outro:
    "The Cloud Queen walks the cobblestones, taps the Welcome Hall doors with her sceptre, and declares Kubetopia a Certified Well-Architected Town — the first in the archipelago. In her speech she says only: 'Your pods are not merely Running. They are Ready.' Elowen cries. The intern gets a sixth coffee. You get the royal seal on your console.",
  parTicks: 240,
  buildCluster: () => {
    const c = emptyCluster();
    c.nodes.push(
      makeNode("control-plane", { roles: "control-plane" }),
      makeNode("worker-1"),
      makeNode("worker-2"),
      makeNode("worker-3")
    );
    c.registry = {
      "bakery-web:1.4": { exists: true, logs: ["bakery-web 1.4 — royal croissant order received"] },
      "welcome-hall:4.0": {
        exists: true,
        logs: ["welcome-hall 4.0: doors polished", "listening on :8080", "awaiting dignitaries"],
      },
      "banners:2.5": { exists: true, logs: ["banners 2.5 starting..."] },
    };
    c.configMaps.push({
      name: "banner-config",
      // The intern created the map... but not the key the app reads.
      data: { "town.motto": "Always Reconciling" },
    });
    c.deployments.push(
      makeDeployment("bakery-web", { replicas: 2, image: "bakery-web:1.4" }),
      makeDeployment("welcome-hall", {
        replicas: 2,
        image: "welcome-hall:4.0",
        containerPort: 8080,
        probePort: 9090, // the misconfigured readiness probe
      }),
      makeDeployment("town-banners", {
        replicas: 2,
        image: "banners:2.5",
        configRef: { name: "banner-config", key: "royal.theme" },
      })
    );
    c.services.push(
      { name: "bakery-svc", selectorApp: "bakery-web", port: 80 },
      { name: "welcome-svc", selectorApp: "welcome-hall", port: 80 },
      { name: "banner-svc", selectorApp: "town-banners", port: 80 }
    );
    return c;
  },
  objectives: [
    {
      id: "triage-royal",
      title: "Hear the royal complaints",
      description:
        "Two ailments, two diagnoses: read the logs of a crashing town-banners pod, and describe a welcome-hall pod that is Running yet 0/1 Ready.",
      points: 150,
      hint: "`kubectl get pods`, then `kubectl logs <town-banners-pod>` (which config key is missing?) and `kubectl describe pod <welcome-hall-pod>` (which port is the probe hitting?).",
      check: (ctx) =>
        ranCommand(ctx, /kubectl\s+logs\s+town-banners-/) &&
        ranCommand(ctx, /kubectl\s+describe\s+(po|pod|pods)\s+welcome-hall-/),
    },
    {
      id: "banners",
      title: "Raise the royal banners",
      description:
        "The banner app reads config key `royal.theme` from ConfigMap banner-config — which doesn't have it. Add the key (any regal value will do) and let the pods crash-loop their way back to life.",
      points: 300,
      hint: '`kubectl edit configmap banner-config` — under data:, add a line like `royal.theme: "cumulus-gold"`. Apply, then watch the pods recover on their next restart.',
      check: (ctx) => {
        const cm = ctx.cluster.configMaps.find((c) => c.name === "banner-config");
        return !!cm && "royal.theme" in cm.data && deploymentHealthy(ctx.cluster, "town-banners", 2);
      },
    },
    {
      id: "welcome",
      title: "Ring the Welcome Hall ready",
      description:
        "The Welcome Hall listens on port 8080, but its readiness probe knocks on 9090 — so Kubernetes never sends it guests. Point the probe at the right door.",
      points: 300,
      hint: "`kubectl edit deployment/welcome-hall` — find readinessProbe.httpGet.port and change 9090 to 8080. Apply and wait for 2/2 Ready.",
      check: (ctx) => {
        const d = ctx.cluster.deployments.find((x) => x.name === "welcome-hall");
        if (!d) return false;
        const listens = d.containerPort ?? 8080;
        return (d.probePort === undefined || d.probePort === listens) && deploymentHealthy(ctx.cluster, "welcome-hall", 2);
      },
    },
    {
      id: "certification",
      title: "Pass the royal inspection",
      description:
        "The Queen inspects at full pomp: Welcome Hall at 4 replicas for the procession, banners flying, bakery baking, zero Pending pods. Everything Ready. Capital R.",
      points: 250,
      hint: "`kubectl scale deployment/welcome-hall --replicas=4`, then confirm every deployment is fully Ready with `kubectl get deploy` and no Pending in `kubectl get pods`.",
      check: (ctx) =>
        deploymentHealthy(ctx.cluster, "welcome-hall", 4) &&
        deploymentHealthy(ctx.cluster, "town-banners", 2) &&
        deploymentHealthy(ctx.cluster, "bakery-web", 2) &&
        noPendingPods(ctx.cluster),
    },
  ],
  events: [
    {
      atTick: 40,
      title: "🕊️ Royal herald",
      speaker: "crier",
      story:
        "HEAR YE! A royal airship has been sighted beyond the clouds! The Cloud Queen's inspection is CONFIRMED for today! Banners! Readiness! PANIC — no wait, the opposite of panic!",
    },
    {
      atTick: 90,
      title: "👑 Royal protocol check",
      speaker: "committee",
      story:
        "Darling, protocol demands the Welcome Hall receive guests the MOMENT the Queen lands. If Kubernetes marks it unready, the royal doors stay shut and we all pretend to admire the fountain. Fix that probe.",
    },
    {
      atTick: QUEEN_ARRIVES_AT,
      title: "👑 The Cloud Queen lands",
      speaker: "queen",
      story:
        "We are pleased to walk your little town. Our inspectors count replicas as we speak. We do hope every pod is Ready — We have seen towns that were merely Running. We were not amused.",
    },
  ],
};

export default level7;
