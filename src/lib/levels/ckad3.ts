import { createPodFor, emptyCluster, makeDeployment, makeNode, serviceHealth } from "../k8s/engine";
import { deploymentHealthy, ranCommand } from "./helpers";
import type { LevelDef } from "./types";

/**
 * CKAD Mission 3 — observability. Two wards, two different sicknesses:
 * the ICU telemetry is Running but never Ready (readiness probe on the
 * wrong port), while the ward dashboard crash-loops on missing config.
 * The player must tell the two apart and cure both.
 */

const ckad3: LevelDef = {
  id: 10,
  slug: "the-heartbeat-monitors",
  name: "The Heartbeat Monitors",
  tagline: "Every monitor is green except the ones that matter — Running is not Ready.",
  track: "ckad",
  skills: ["readiness probes", "Running vs Ready", "logs, events & describe"],
  story: [
    {
      speaker: "doctor",
      text: "The ICU got new heartbeat telemetry last night. The pods say Running. The dashboards say NOTHING. Every screen in intensive care is a beautiful, terrifying shade of blank.",
    },
    {
      speaker: "kublet",
      text: "Beep! Sneaky one, this. Running means the container started. READY means the readiness probe passed — and only Ready pods receive traffic from a Service. A pod can run happily forever while the probe knocks on a door nobody answers.",
    },
    {
      speaker: "mentor",
      text: "Two broken apps, kid, two DIFFERENT diseases. Don't guess — diagnose. `kubectl get pods` tells you who's sick, `kubectl describe pod` and `kubectl get events` tell you why. Treat the cause, not the symptom.",
    },
  ],
  outro:
    "The monitors bloom back to life — sixty heartbeats a minute, sixty frames a second. Dr. Iris tapes a card to the ICU door: 'Running ≠ Ready. Check the probe port.' Old Sal nods once, which from him is a standing ovation.",
  parTicks: 230,
  buildCluster: () => {
    const c = emptyCluster();
    c.nodes.push(
      makeNode("control-plane", { roles: "control-plane" }),
      makeNode("worker-1"),
      makeNode("worker-2"),
      makeNode("worker-3")
    );
    c.registry = {
      "admissions-web:1.0": { exists: true, logs: ["admissions-web 1.0: intake forms loaded"] },
      "telemetry:2.4": {
        exists: true,
        logs: ["telemetry 2.4: 40 beds connected", "serving metrics on :8080", "waiting for scrapes..."],
      },
      "ward-dashboard:1.6": {
        exists: true,
        logs: ["ward-dashboard 1.6 booting..."],
      },
    };
    c.configMaps.push({
      name: "ward-config",
      // "wards.enabled" is what the dashboard needs; it's not here.
      data: { "welcome.banner": "Get well soon!" },
    });
    const admissions = makeDeployment("admissions-web", { replicas: 2, image: "admissions-web:1.0" });
    const telemetry = makeDeployment("telemetry", {
      replicas: 3,
      image: "telemetry:2.4",
      critical: true,
      containerPort: 8080,
      probePort: 9090, // the classic: probe knocks where nobody listens
    });
    const dashboard = makeDeployment("ward-dashboard", {
      replicas: 2,
      image: "ward-dashboard:1.6",
      configRef: { name: "ward-config", key: "wards.enabled" },
    });
    c.deployments.push(admissions, telemetry, dashboard);
    c.services.push(
      { name: "admissions-svc", selectorApp: "admissions-web", port: 80 },
      { name: "icu-svc", selectorApp: "telemetry", port: 443 },
      { name: "ward-svc", selectorApp: "ward-dashboard", port: 80 }
    );
    // Pre-seed both failure modes so the contrast is visible immediately:
    // telemetry Running-but-not-Ready, dashboard crash-looping.
    const workers = ["worker-1", "worker-2", "worker-3"];
    for (let i = 0; i < 3; i++) {
      const p = createPodFor(c, telemetry);
      p.nodeName = workers[i];
      p.phase = "Running";
      p.ready = false;
      p.phaseTicks = 10;
    }
    for (let i = 0; i < 2; i++) {
      const p = createPodFor(c, dashboard);
      p.nodeName = workers[i];
      p.phase = "CrashLoopBackOff";
      p.restarts = 6 + i;
      p.backoff = 8;
    }
    return c;
  },
  objectives: [
    {
      id: "triage",
      title: "Triage the two outages",
      description:
        "telemetry pods are Running yet 0/1 Ready; ward-dashboard pods are crash-looping. Same ward, different diseases — gather evidence with describe or the event log.",
      points: 150,
      hint: "`kubectl get pods` first. Then `kubectl describe pod <telemetry-pod>` and `kubectl get events` — read what the probe and the crashes are complaining about.",
      check: (ctx) =>
        ranCommand(ctx, /kubectl\s+get\s+(events|ev)\b/) ||
        ranCommand(ctx, /kubectl\s+describe\s+(po|pod|pods)\s+\S+/),
    },
    {
      id: "probe",
      title: "Fix the heartbeat probe",
      description:
        "The telemetry container listens on port 8080, but its readiness probe knocks on 9090 — so no pod ever goes Ready and icu-svc has no endpoints. Correct the probe. All 3 replicas Ready.",
      points: 300,
      hint: "`kubectl edit deployment/telemetry` — change the readinessProbe httpGet port from 9090 to 8080 (the containerPort), then Apply and watch the pods go Ready.",
      check: (ctx) => {
        const d = ctx.cluster.deployments.find((x) => x.name === "telemetry");
        if (!d) return false;
        const listens = d.containerPort ?? 8080;
        const probeOk = d.probePort === undefined || d.probePort === listens;
        return probeOk && deploymentHealthy(ctx.cluster, "telemetry", 3);
      },
    },
    {
      id: "dashboard",
      title: "Relight the ward dashboards",
      description:
        "ward-dashboard crashes for a different reason entirely: it demands the key `wards.enabled` from ConfigMap ward-config. Give it what it wants — both replicas Ready.",
      points: 250,
      hint: '`kubectl logs <ward-dashboard-pod>` names the missing key. `kubectl edit configmap ward-config` and add e.g. `wards.enabled: "icu,maternity,pediatrics"`.',
      check: (ctx) => {
        const cm = ctx.cluster.configMaps.find((x) => x.name === "ward-config");
        return !!cm && "wards.enabled" in cm.data && deploymentHealthy(ctx.cluster, "ward-dashboard", 2);
      },
    },
    {
      id: "code-yellow",
      title: "Code Yellow: monitor every bed",
      description:
        "The east wing is admitting overflow patients. Scale telemetry to 5 replicas and keep every hospital service serving.",
      points: 250,
      hint: "`kubectl scale deployment/telemetry --replicas=5`, then confirm icu-svc, ward-svc and admissions-svc all show ready endpoints via `kubectl get svc`.",
      check: (ctx) =>
        deploymentHealthy(ctx.cluster, "telemetry", 5) &&
        serviceHealth(ctx.cluster, "icu-svc") >= 1 &&
        serviceHealth(ctx.cluster, "ward-svc") >= 1 &&
        serviceHealth(ctx.cluster, "admissions-svc") >= 1,
    },
  ],
  events: [
    {
      atTick: 50,
      title: "🩺 Night nurse's report",
      speaker: "doctor",
      story:
        "Night nurse Wren says the telemetry boxes are warm and humming — the APP is running. But the service shows zero endpoints. Kublet mumbled something about 'a probe knocking on the wrong port'...",
    },
    {
      atTick: 140,
      title: "🟡 Code Yellow",
      speaker: "crier",
      story:
        "HEAR YE! Overflow patients from the ferry mishap are being wheeled into the east wing! Every new bed needs a heartbeat monitor — the ICU telemetry must scale UP!",
    },
  ],
};

export default ckad3;
