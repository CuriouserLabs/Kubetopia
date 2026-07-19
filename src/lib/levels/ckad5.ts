import { createPodFor, emptyCluster, makeDeployment, makeNode, serviceHealth } from "../k8s/engine";
import { deploymentHealthy, noPendingPods } from "./helpers";
import type { LevelDef } from "./types";

/**
 * CKAD Mission 5 — the finale. An island-wide outbreak hits Kubetopia
 * General all at once: a missing Secret starves the lab, a selector typo
 * cuts the oxygen dashboard, and the surge demands capacity the gift shop
 * is hogging. Everything from missions 1–4, under pressure.
 */

const SECRET_YAML = `# natl-health-api.yaml — credentials for the National Health Registry uplink
# Requested by the lab. Scribbled down by Devin. Verify EVERYTHING.
apiVersion: v1
kind: Secret
metadata:
  name: natl-health-api
type: Opaque
stringData:
  apiToken: NHR-kubetopia-7742-lab
`;

const ckad5: LevelDef = {
  id: 12,
  slug: "outbreak-protocol",
  name: "Outbreak Protocol",
  tagline: "Everything you've learned, all at once, with the whole island coughing.",
  track: "ckad",
  skills: ["multi-fault incident response", "Secrets under pressure", "capacity triage for critical care"],
  story: [
    {
      speaker: "weather",
      text: "This just in from Storm Watch — except it's not weather this time. Ferries are arriving full of sneezing tourists. The Health Registry has upgraded the island flu to an OUTBREAK. All eyes on Kubetopia General.",
    },
    {
      speaker: "doctor",
      text: "It's all happening at once! The lab analyzer can't reach the National Health Registry — it needs an API token from a Secret that nobody ever created. The oxygen dashboard shows NO DATA. And the triage queue is out the door and around the fountain.",
    },
    {
      speaker: "mentor",
      text: "Deep breath, kid. This is the whole job in one shift: fix the Secret, fix the Service, then make ROOM — the cluster is only so big, and when beds compete with the gift shop, the gift shop loses. Triage the town like you'd triage a patient.",
    },
  ],
  outro:
    "By sunrise the curve is bending: labs flowing to the Registry, oxygen numbers green, six triage desks humming, and a field lab pipetting at full speed. The gift shop reopens a week later with a new bestseller: a plush pod that squeaks 'Ready 1/1' when you squeeze it. Dr. Iris shakes your hand: 'Whatever they pay you, it isn't enough.' The Cloud Queen, they say, read the incident report twice.",
  parTicks: 300,
  files: {
    "natl-health-api.yaml": SECRET_YAML,
  },
  buildCluster: () => {
    const c = emptyCluster();
    c.nodes.push(
      makeNode("control-plane", { roles: "control-plane" }),
      makeNode("worker-1"),
      makeNode("worker-2"),
      makeNode("worker-3")
    );
    c.registry = {
      "triage-desk:2.2": {
        exists: true,
        logs: ["triage-desk 2.2: queue engine warm", "listening on :8080"],
      },
      "lab-analyzer:5.5": {
        exists: true,
        logs: ["lab-analyzer 5.5: centrifuge spun up", "connecting to National Health Registry..."],
      },
      "oxygen-scheduler:3.0": {
        exists: true,
        logs: ["oxygen-scheduler 3.0: 64 tanks tracked", "listening on :8080"],
      },
      "gift-shop:1.1": {
        exists: true,
        logs: ["gift-shop 1.1: balloons inflated", "plush pods restocked"],
      },
    };
    const triage = makeDeployment("triage-desk", {
      replicas: 2,
      image: "triage-desk:2.2",
      critical: true,
      cpuPerPod: 400,
    });
    const lab = makeDeployment("lab-analyzer", {
      replicas: 2,
      image: "lab-analyzer:5.5",
      cpuPerPod: 300,
      secretRef: { name: "natl-health-api", key: "api-token" },
    });
    const oxygen = makeDeployment("oxygen-scheduler", {
      replicas: 2,
      image: "oxygen-scheduler:3.0",
      critical: true,
      cpuPerPod: 300,
    });
    const giftShop = makeDeployment("gift-shop", {
      replicas: 3,
      image: "gift-shop:1.1",
      cpuPerPod: 600,
    });
    c.deployments.push(triage, lab, oxygen, giftShop);
    c.services.push(
      { name: "triage-svc", selectorApp: "triage-desk", port: 80 },
      { name: "lab-svc", selectorApp: "lab-analyzer", port: 443 },
      // The typo that blanks the oxygen dashboard.
      { name: "oxygen-svc", selectorApp: "oxygen-schedler", port: 443 },
      { name: "gift-svc", selectorApp: "gift-shop", port: 80 }
    );
    // The lab is already down when the shift starts.
    for (let i = 0; i < 2; i++) {
      const p = createPodFor(c, lab);
      p.nodeName = i === 0 ? "worker-1" : "worker-2";
      p.phase = "CrashLoopBackOff";
      p.restarts = 7 + i;
      p.backoff = 8;
    }
    return c;
  },
  objectives: [
    {
      id: "lab",
      title: "Restore the lab uplink",
      description:
        "lab-analyzer crash-loops: it needs the key `api-token` from Secret natl-health-api — which doesn't exist yet. Devin left a draft in natl-health-api.yaml, but check his key name against what the pods actually demand.",
      points: 250,
      hint: "`kubectl logs <lab-pod>` names the required key: api-token. Devin's draft says apiToken. `kubectl apply -f natl-health-api.yaml`, rename the key to `api-token` in the editor, Apply — then watch the lab pods recover.",
      check: (ctx) => {
        const sec = ctx.cluster.secrets.find((s) => s.name === "natl-health-api");
        return !!sec && "api-token" in sec.data && deploymentHealthy(ctx.cluster, "lab-analyzer", 2);
      },
    },
    {
      id: "oxygen",
      title: "Reconnect the oxygen line",
      description:
        "oxygen-svc shows zero endpoints even though the scheduler pods are Ready. Somebody fat-fingered the Service selector. Find the typo and fix it.",
      points: 250,
      hint: "`kubectl get svc` — oxygen-svc selects app=oxygen-schedler (note the missing 'u'). Fix it: `kubectl patch service oxygen-svc -p '{\"spec\":{\"selector\":{\"app\":\"oxygen-scheduler\"}}}'`.",
      check: (ctx) => {
        const svc = ctx.cluster.services.find((s) => s.name === "oxygen-svc");
        return !!svc && svc.selectorApp === "oxygen-scheduler" && serviceHealth(ctx.cluster, "oxygen-svc") >= 1;
      },
    },
    {
      id: "surge",
      title: "Surge the triage desks",
      description:
        "Outbreak protocol demands SIX triage desks, all Ready, with nothing stuck Pending. The cluster is only so big — if new desks won't schedule, something non-critical has to shrink. The mayor has opinions about the gift shop.",
      points: 350,
      hint: "`kubectl scale deployment/triage-desk --replicas=6`. If pods sit Pending, check `kubectl get nodes` for CPU — then `kubectl scale deployment/gift-shop --replicas=1` (or 0) to free capacity.",
      check: (ctx) =>
        deploymentHealthy(ctx.cluster, "triage-desk", 6) && noPendingPods(ctx.cluster),
    },
    {
      id: "field-lab",
      title: "Stand up the field lab",
      description:
        "Sample crates are stacking up on the dock. Scale lab-analyzer to 4 and keep every critical service — triage, oxygen, lab — serving with no Pending pods. Hold the line until dawn.",
      points: 350,
      hint: "`kubectl scale deployment/lab-analyzer --replicas=4`. Then a final ward round: `kubectl get pods`, `kubectl get svc` — everything Ready, nothing Pending, all services with endpoints.",
      check: (ctx) =>
        deploymentHealthy(ctx.cluster, "lab-analyzer", 4) &&
        deploymentHealthy(ctx.cluster, "triage-desk", 6) &&
        noPendingPods(ctx.cluster) &&
        serviceHealth(ctx.cluster, "triage-svc") >= 1 &&
        serviceHealth(ctx.cluster, "oxygen-svc") >= 1 &&
        serviceHealth(ctx.cluster, "lab-svc") >= 1,
    },
  ],
  events: [
    {
      atTick: 60,
      title: "🦠 Outbreak declared",
      speaker: "doctor",
      story:
        "The Registry made it official: OUTBREAK. Protocol requires six triage desks online. Six! We usually run two and one of those is decorative. Make room however you must.",
    },
    {
      atTick: 95,
      title: "🎈 Executive order",
      speaker: "mayor",
      story:
        "As mayor AND as someone whose niece works there: close the gift shop. Balloons do not outrank beds. Scale it down and give the hospital every millicore it needs. I'll sign whatever needs signing.",
    },
    {
      atTick: 150,
      title: "🧪 Samples on the dock",
      speaker: "crier",
      story:
        "HEAR YE! The morning ferry brought three hundred test samples and one VERY seasick courier! The lab must scale into a field lab, or the crates will start forming their own queue government!",
    },
  ],
};

export default ckad5;
