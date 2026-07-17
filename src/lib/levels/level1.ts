import {
  createPodFor,
  emptyCluster,
  makeDeployment,
  makeNode,
} from "../k8s/engine";
import { deploymentHealthy, ranCommand } from "./helpers";
import type { LevelDef } from "./types";

/**
 * Level 1 — the tutorial. A crashing image (bad tag pushed to prod) and a
 * lunchtime traffic bump. Teaches get / describe / logs / set image / scale.
 */
const level1: LevelDef = {
  id: 1,
  slug: "first-shift",
  name: "First Shift at Kubetopia",
  tagline: "The bakery's website is down and the mayor wants croissants.",
  skills: ["kubectl get / describe / logs", "fixing a CrashLoopBackOff", "scaling a deployment"],
  story: [
    {
      speaker: "kublet",
      text: "Beep! Welcome to Kubetopia — a tiny floating island town where every building is a Kubernetes node and every glowing crate is a pod keeping the town running. I'm Kublet, your pager-bot!",
    },
    {
      speaker: "mentor",
      text: "You're the new Site Reliability Engineer, kid. Your predecessor left in a hurry (something about 'YAML-induced burnout') and their last act was deploying version 2.0-beta of the bakery website... on a Friday.",
    },
    {
      speaker: "mayor",
      text: "The bakery's online ordering page is DOWN, the morning croissant rush starts soon, and I am already drafting a strongly-worded email. Open the console and look around with `kubectl get pods` and `kubectl get nodes`. Please. The croissants depend on you.",
    },
  ],
  outro:
    "The bakery survives the croissant rush, Mayor Beatrix sends you a thank-you muffin, and the town's happiness meter is glowing. Not bad for a first shift — but Kubetopia is about to get a lot busier.",
  parTicks: 120,
  buildCluster: () => {
    const c = emptyCluster();
    c.nodes.push(
      makeNode("control-plane", { roles: "control-plane" }),
      makeNode("worker-1"),
      makeNode("worker-2")
    );
    c.registry = {
      "bakery-web:1.4": {
        exists: true,
        logs: ["bakery-web 1.4 — oven preheated", "listening on :8080", "GET /croissants 200"],
      },
      "bakery-web:2.0-beta": {
        exists: true,
        crashes: true,
        logs: [
          "bakery-web 2.0-beta starting...",
          "panic: cannot connect to database 'croissant_db_v2' (it does not exist)",
          "goroutine 1 [running]: main.main() exited with code 1",
        ],
      },
    };
    const bakery = makeDeployment("bakery-web", {
      replicas: 2,
      image: "bakery-web:2.0-beta",
      previousImage: "bakery-web:1.4",
    });
    c.deployments.push(bakery);
    c.services.push({ name: "bakery-svc", selectorApp: "bakery-web", port: 80 });
    // Pre-seed pods already stuck in a crash loop so the outage is visible
    // the moment the level loads.
    for (let i = 0; i < 2; i++) {
      const p = createPodFor(c, bakery);
      p.nodeName = i === 0 ? "worker-1" : "worker-2";
      p.phase = "CrashLoopBackOff";
      p.restarts = 4 + i;
      p.backoff = 8;
    }
    return c;
  },
  objectives: [
    {
      id: "recon",
      title: "Survey your new town",
      description:
        "Get your bearings: list the pods and the nodes. (Every good SRE looks before they touch.)",
      points: 100,
      hint: "Run `kubectl get pods` and `kubectl get nodes`.",
      check: (ctx) =>
        ranCommand(ctx, /kubectl\s+get\s+(po|pod|pods)\b/) &&
        ranCommand(ctx, /kubectl\s+get\s+(no|node|nodes)\b/),
    },
    {
      id: "diagnose",
      title: "Find out why the bakery is burning",
      description:
        "The bakery-web pods are in CrashLoopBackOff. Read a pod's logs or describe it to find the culprit.",
      points: 150,
      hint: "Run `kubectl logs <pod-name>` on one of the bakery-web pods — copy the name from `kubectl get pods`.",
      check: (ctx) =>
        ranCommand(ctx, /kubectl\s+(logs|describe\s+(po|pod|pods))\s+bakery-web-/),
    },
    {
      id: "fix",
      title: "Serve croissants again",
      description:
        "The 2.0-beta image is broken. Roll the deployment back to the last good image and get every replica Ready.",
      points: 250,
      hint: "Either `kubectl rollout undo deployment/bakery-web` or `kubectl set image deployment/bakery-web web=bakery-web:1.4`. Then watch `kubectl get pods`.",
      check: (ctx) => {
        const d = ctx.cluster.deployments.find((x) => x.name === "bakery-web");
        if (!d || ctx.cluster.registry[d.image]?.crashes) return false;
        return deploymentHealthy(ctx.cluster, "bakery-web", 2);
      },
    },
    {
      id: "scale",
      title: "Brace for the lunch rush",
      description:
        "Mayor Beatrix expects triple traffic at noon. Scale bakery-web to 3 replicas and get them all Ready.",
      points: 200,
      hint: "Run `kubectl scale deployment/bakery-web --replicas=3`.",
      check: (ctx) => deploymentHealthy(ctx.cluster, "bakery-web", 3),
    },
  ],
  events: [
    {
      atTick: 45,
      title: "📯 Town Crier",
      speaker: "crier",
      story:
        "HEAR YE! Word on the cobblestones: the noon croissant rush is going to be the biggest of the year! If the bakery site isn't fixed and scaled up, the townsfolk will NOT be happy!",
    },
  ],
};

export default level1;
