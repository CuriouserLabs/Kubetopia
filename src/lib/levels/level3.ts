import {
  emptyCluster,
  failNode,
  makeDeployment,
  makeNode,
  recoverNode,
} from "../k8s/engine";
import {
  deploymentHealthy,
  nodeBackInService,
  nodeDrained,
  ranCommand,
} from "./helpers";
import type { LevelDef } from "./types";

const NODE_FAILS_AT = 25;
const NODE_RECOVERS_AT = 110;

/**
 * Level 3 — node failure at night. Teaches the cordon/drain/uncordon cycle
 * and why waiting for automatic eviction is the slow way.
 */
const level3: LevelDef = {
  id: 3,
  slug: "blackout-at-midnight",
  name: "Blackout at Midnight",
  tagline: "A node goes dark, and half the town's lights go with it.",
  skills: ["node failures & pod eviction", "cordon / drain / uncordon", "reading kubectl get events"],
  story: [
    {
      speaker: "kublet",
      text: "It's a quiet midnight shift in Kubetopia. Streetlights hum, the water plant gurgles, the pizza shop bakes for the night owls. Too quiet, honestly. My sensors are... tingling.",
    },
    {
      text: "Your pager is charged. The town sleeps. Somewhere in the distance, a seagull with the energy of a chaos monkey eyes the power lines above one of the worker buildings...",
    },
    {
      speaker: "mentor",
      text: "Remember your training: when a node dies, its pods don't move on their own right away — Kubernetes waits a long grace period before evicting them. A sharp SRE drains the dead node to force pods to reschedule immediately. Keep `kubectl get nodes` and `kubectl get events` handy.",
    },
  ],
  outro:
    "Power restored, seagull relocated to a nice farm upstate, and the townsfolk slept through the whole thing — which is the highest compliment an SRE can receive.",
  parTicks: 180,
  buildCluster: () => {
    const c = emptyCluster();
    c.nodes.push(
      makeNode("control-plane", { roles: "control-plane" }),
      makeNode("worker-1"),
      makeNode("worker-2"),
      makeNode("worker-3")
    );
    c.registry = {
      "streetlights:1.8": { exists: true, logs: ["streetlights: 342 lamps glowing"] },
      "water-plant:4.1": { exists: true, logs: ["water-plant: pressure nominal, ducks happy"] },
      "pizza-shop:2.2": { exists: true, logs: ["pizza-shop: 17 midnight pizzas in the oven"] },
    };
    c.deployments.push(
      makeDeployment("streetlights", { replicas: 3, image: "streetlights:1.8", critical: true }),
      makeDeployment("water-plant", { replicas: 2, image: "water-plant:4.1", critical: true, cpuPerPod: 400, memPerPod: 512 }),
      makeDeployment("pizza-shop", { replicas: 2, image: "pizza-shop:2.2" })
    );
    c.services.push(
      { name: "streetlights-svc", selectorApp: "streetlights", port: 80 },
      { name: "water-svc", selectorApp: "water-plant", port: 80 },
      { name: "pizza-svc", selectorApp: "pizza-shop", port: 80 }
    );
    return c;
  },
  objectives: [
    {
      id: "detect",
      title: "Answer the page",
      description:
        "Something just went dark. Confirm which node stopped reporting before touching anything.",
      points: 150,
      hint: "Run `kubectl get nodes` (and `kubectl get events`) after the blackout hits — one node will show NotReady.",
      check: (ctx) =>
        ctx.cluster.nodes.some((n) => n.status === "NotReady") &&
        ranCommand(ctx, /kubectl\s+get\s+(no|node|nodes)\b/, NODE_FAILS_AT),
    },
    {
      id: "drain",
      title: "Evacuate the dark building",
      description:
        "Pods on worker-2 are stuck in Unknown — Kubernetes will wait ages before evicting them on its own. Drain the node so they reschedule NOW.",
      points: 300,
      hint: "Run `kubectl drain worker-2 --ignore-daemonsets` (cordon + delete pod also works, but drain is the pro move).",
      check: (ctx) => nodeDrained(ctx.cluster, "worker-2"),
    },
    {
      id: "restore",
      title: "Relight the town",
      description:
        "Get every service back to full strength on the surviving nodes — streetlights and the water plant first, they're critical.",
      points: 300,
      hint: "Watch `kubectl get pods -o wide` — evicted pods should reschedule onto worker-1 and worker-3 automatically once the node is drained.",
      check: (ctx) =>
        deploymentHealthy(ctx.cluster, "streetlights", 3) &&
        deploymentHealthy(ctx.cluster, "water-plant", 2) &&
        deploymentHealthy(ctx.cluster, "pizza-shop", 2),
    },
    {
      id: "reinstate",
      title: "Welcome worker-2 back",
      description:
        "The power company fixed the line and worker-2 is Ready again — but it's still cordoned from the drain. Put it back into service.",
      points: 150,
      hint: "Run `kubectl uncordon worker-2` once the node shows Ready.",
      check: (ctx) =>
        ctx.tick > NODE_RECOVERS_AT && nodeBackInService(ctx.cluster, "worker-2"),
    },
  ],
  events: [
    {
      atTick: NODE_FAILS_AT,
      title: "🚨 PAGER: NodeNotReady",
      speaker: "kublet",
      story:
        "BZZZT-BEEP! A seagull just short-circuited the power line to worker-2! The building is dark, its pods are unreachable, and the streetlights on that side of town are flickering out. Diagnose, then evacuate!",
      mutate: (c) => failNode(c, "worker-2"),
    },
    {
      atTick: NODE_RECOVERS_AT,
      title: "🔌 Power Company",
      speaker: "power",
      story:
        "Line's fixed! worker-2 has power again and reports Ready — but it's still cordoned, so the scheduler is ignoring it. Bring it back into the rotation.",
      mutate: (c) => recoverNode(c, "worker-2"),
    },
  ],
};

export default level3;
