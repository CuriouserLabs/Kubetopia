import { emptyCluster, makeDeployment, makeNode, serviceHealth } from "../k8s/engine";
import { deploymentHealthy, ranCommand } from "./helpers";
import type { LevelDef } from "./types";

/**
 * CKAD Mission 4 — deployment lifecycle. The player ships patient-records
 * 5.0 themselves, watches the migration blow up, rolls back under pressure,
 * then lands the 5.1 hotfix and scales for visiting hours.
 */

const ckad4: LevelDef = {
  id: 11,
  slug: "the-records-rollout",
  name: "The Records Rollout",
  tagline: "You get to push the button this time. The button pushes back.",
  track: "ckad",
  skills: ["rollouts & rollbacks", "set image / rollout undo / status", "deploying critical apps safely"],
  story: [
    {
      speaker: "doctor",
      text: "Big day! Patient Records 5.0 is approved: new allergy fields, faster charts, a font that doesn't look like a ransom note. The upgrade is YOURS to ship. What's the worst that could happen?",
    },
    {
      speaker: "mentor",
      text: "Kid, before you touch that deployment, burn this into your brain: know your way BACK before you go forward. `kubectl rollout undo` has saved more careers than coffee. Records is a critical app — if it goes down, the whole hospital feels it.",
    },
    {
      speaker: "kublet",
      text: "Beep! Release checklist loaded: 1) ship 5.0 with `kubectl set image`, 2) watch `kubectl get pods` like a hawk, 3) if it burns, roll back FIRST and read logs second. Good luck! Statistically, you'll need it!",
    },
  ],
  outro:
    "Records 5.1 settles in like it was always there: allergies load, charts fly, the ransom-note font is gone forever. Dr. Iris frames a printout of your terminal history and titles it 'Anatomy of a Rollback'. Old Sal mutters 'shipped, burned, recovered, reshipped — that's the whole job, kid.'",
  parTicks: 250,
  buildCluster: () => {
    const c = emptyCluster();
    c.nodes.push(
      makeNode("control-plane", { roles: "control-plane" }),
      makeNode("worker-1"),
      makeNode("worker-2"),
      makeNode("worker-3")
    );
    c.registry = {
      "patient-records:4.2": {
        exists: true,
        logs: ["patient-records 4.2: 12,481 charts indexed", "listening on :8080"],
      },
      "patient-records:5.0": {
        exists: true,
        crashes: true,
        logs: [
          "patient-records 5.0 starting...",
          "running schema migration 0042_add_allergy_fields...",
          'ERROR: column "allergies" already exists',
          "migration failed — rolling back transaction",
          "process exited with code 1",
        ],
      },
      // patient-records:5.1 arrives later, via the hotfix event.
      "xray-archive:2.0": {
        exists: true,
        logs: ["xray-archive 2.0: 88,000 scans on cold storage", "listening on :8080"],
      },
    };
    c.deployments.push(
      makeDeployment("patient-records", {
        replicas: 3,
        image: "patient-records:4.2",
        critical: true,
        cpuPerPod: 300,
      }),
      makeDeployment("xray-archive", { replicas: 2, image: "xray-archive:2.0" })
    );
    c.services.push(
      { name: "records-svc", selectorApp: "patient-records", port: 443 },
      { name: "xray-svc", selectorApp: "xray-archive", port: 80 }
    );
    return c;
  },
  objectives: [
    {
      id: "ship",
      title: "Ship Patient Records 5.0",
      description:
        "The release is approved and the button is yours: roll patient-records to image patient-records:5.0.",
      points: 150,
      hint: "`kubectl set image deployment/patient-records records=patient-records:5.0` — then keep your eyes on `kubectl get pods`.",
      check: (ctx) =>
        ctx.cluster.deployments.some(
          (d) => d.name === "patient-records" && d.image === "patient-records:5.0"
        ),
    },
    {
      id: "rollback",
      title: "Stop the bleeding",
      description:
        "5.0's migration is failing and the new pods are crash-looping — doctors are locked out of charts. Roll back to the last good version and get all 3 replicas Ready. Read the logs later; recover NOW.",
      points: 300,
      hint: "`kubectl rollout undo deployment/patient-records` takes you straight back to 4.2. Confirm with `kubectl get pods` — 3/3 Ready.",
      check: (ctx) => {
        const d = ctx.cluster.deployments.find((x) => x.name === "patient-records");
        if (!d || ctx.cluster.registry[d.image]?.crashes) return false;
        return deploymentHealthy(ctx.cluster, "patient-records", 3);
      },
    },
    {
      id: "hotfix",
      title: "Land the 5.1 hotfix",
      description:
        "Upstream shipped patient-records:5.1 with the migration fixed. Ship it — carefully this time — and verify the rollout completes.",
      points: 300,
      hint: "Wait for the hotfix announcement, then `kubectl set image deployment/patient-records records=patient-records:5.1` and check `kubectl rollout status deployment/patient-records`.",
      check: (ctx) => {
        const d = ctx.cluster.deployments.find((x) => x.name === "patient-records");
        return !!d && d.image === "patient-records:5.1" && deploymentHealthy(ctx.cluster, "patient-records", 3);
      },
    },
    {
      id: "visiting",
      title: "Survive visiting hours",
      description:
        "Families are arriving and every relative wants the chart explained twice. Scale patient-records to 5 replicas, verify the rollout, and keep the X-ray archive serving too.",
      points: 250,
      hint: "`kubectl scale deployment/patient-records --replicas=5`, then `kubectl rollout status deployment/patient-records` until it reports success. `kubectl get svc` should show endpoints on records-svc and xray-svc.",
      check: (ctx) =>
        ranCommand(ctx, /kubectl\s+rollout\s+status\s+(deployment|deployments|deploy)\/patient-records/) &&
        deploymentHealthy(ctx.cluster, "patient-records", 5) &&
        deploymentHealthy(ctx.cluster, "xray-archive", 2) &&
        serviceHealth(ctx.cluster, "records-svc") >= 1,
    },
  ],
  events: [
    {
      atTick: 55,
      title: "🚨 Charts are down!",
      speaker: "doctor",
      story:
        "Dr. Ansel can't open ANY chart in the west wing! If the new version is misbehaving: roll BACK first, do the post-mortem later. The patients can't wait for a bugfix.",
    },
    {
      atTick: 85,
      title: "🩹 Hotfix published",
      speaker: "kublet",
      story:
        "Beep-beep! Upstream just published patient-records:5.1 to the registry — release notes say 'migration 0042 now checks if the column exists first. Sorry about that.' Ready when you are!",
      mutate: (cluster) => {
        cluster.registry["patient-records:5.1"] = {
          exists: true,
          logs: [
            "patient-records 5.1: migration 0042 skipped (already applied)",
            "12,481 charts indexed — allergy fields live",
            "listening on :8080",
          ],
        };
      },
    },
    {
      atTick: 160,
      title: "👨‍👩‍👧 Visiting hours",
      speaker: "crier",
      story:
        "HEAR YE! The two o'clock ferry has docked and it is ENTIRELY grandmothers! Chart lookups are spiking — the records system must scale before the lobby fills with concerned relatives!",
    },
  ],
};

export default ckad4;
