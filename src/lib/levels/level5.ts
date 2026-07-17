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
  noPendingPods,
} from "./helpers";
import type { LevelDef } from "./types";

const STORM_WARNING_AT = 15;
const FIRST_NODE_DOWN_AT = 30;
const SECOND_NODE_DOWN_AT = 50;
const STORM_PASSES_AT = 150;

/**
 * Level 5 — the finale. A storm takes out half the cluster's capacity.
 * Triage under scarcity: drain dead nodes, surge the hospital, sacrifice
 * the arcade, then rebuild when the storm passes.
 */
const level5: LevelDef = {
  id: 5,
  slug: "storm-over-kubetopia",
  name: "Storm Over Kubetopia",
  tagline: "Half the cluster is gone. Choose what lives.",
  skills: ["cascading node failures", "triage under scarce capacity", "prioritizing critical workloads"],
  story: [
    {
      speaker: "weather",
      text: "This is Storm Watch. The sky over Kubetopia has turned the color of a terminal with dark mode and bad news. Storm Sigrid — the worst in island memory — makes landfall tonight.",
    },
    {
      speaker: "doctor",
      text: "Four worker buildings keep this town alive. My hospital app monitors every patient on the island. The traffic-lights keep the evacuation routes moving. The arcade... is an arcade. You understand my priorities.",
    },
    {
      speaker: "mentor",
      text: "When nodes start dropping, there won't be room for everything. A real operator knows the hardest kubectl command is the one that scales something DOWN. Triage like lives depend on it — tonight, in our little town, they do.",
    },
    {
      speaker: "weather",
      text: "Forecast: multiple node failures. Surviving capacity: 2 workers × 2000m CPU. Do the math early, act fast, and keep the hospital running no matter what.",
    },
  ],
  outro:
    "Dawn breaks over Kubetopia. The hospital never blinked, the evacuation routes stayed lit, and the arcade kids forgave you the moment their high scores loaded back in. The town throws a festival in your honor — and this time, the ticket service stays up. You are, officially, a Kubernetes Administrator.",
  parTicks: 260,
  buildCluster: () => {
    const c = emptyCluster();
    c.nodes.push(
      makeNode("control-plane", { roles: "control-plane" }),
      makeNode("worker-1"),
      makeNode("worker-2"),
      makeNode("worker-3"),
      makeNode("worker-4")
    );
    c.registry = {
      "hospital:6.3": { exists: true, logs: ["hospital 6.3: all patient monitors green"] },
      "traffic-lights:2.4": { exists: true, logs: ["traffic-lights: evacuation routes flowing"] },
      "arcade:9.9": { exists: true, logs: ["arcade: 42 kids chasing high scores"] },
      "news-site:3.1": { exists: true, logs: ["news-site: STORM SIGRID APPROACHES — live blog"] },
    };
    c.deployments.push(
      makeDeployment("hospital", { replicas: 3, image: "hospital:6.3", critical: true, cpuPerPod: 300, memPerPod: 512 }),
      makeDeployment("traffic-lights", { replicas: 2, image: "traffic-lights:2.4", critical: true }),
      makeDeployment("arcade", { replicas: 5, image: "arcade:9.9", cpuPerPod: 400, memPerPod: 512 }),
      makeDeployment("news-site", { replicas: 2, image: "news-site:3.1", cpuPerPod: 300 })
    );
    c.services.push(
      { name: "hospital-svc", selectorApp: "hospital", port: 443 },
      { name: "traffic-svc", selectorApp: "traffic-lights", port: 80 },
      { name: "arcade-svc", selectorApp: "arcade", port: 80 },
      { name: "news-svc", selectorApp: "news-site", port: 80 }
    );
    return c;
  },
  objectives: [
    {
      id: "evacuate",
      title: "Evacuate the flooded buildings",
      description:
        "worker-3 and worker-4 are dark and their pods are stranded in Unknown. Drain both so everything reschedules onto the survivors.",
      points: 300,
      hint: "Run `kubectl drain worker-3 --ignore-daemonsets` and the same for worker-4.",
      check: (ctx) =>
        ctx.tick > SECOND_NODE_DOWN_AT &&
        nodeDrained(ctx.cluster, "worker-3") &&
        nodeDrained(ctx.cluster, "worker-4"),
    },
    {
      id: "surge-hospital",
      title: "Surge the hospital",
      description:
        "Storm injuries are coming in. The hospital app needs 5 replicas, all Ready — whatever else it costs.",
      points: 350,
      hint: "`kubectl scale deployment/hospital --replicas=5`. If they stick in Pending, something less important must shrink first...",
      check: (ctx) => deploymentHealthy(ctx.cluster, "hospital", 5),
    },
    {
      id: "triage",
      title: "Make it all fit",
      description:
        "Two workers, 4000m CPU total. Hospital (5×300m) and traffic-lights (2×250m) are untouchable. Shrink the arcade (and the news site if needed) until nothing is Pending.",
      points: 350,
      hint: "Hospital+traffic-lights = 2000m, leaving 2000m. Arcade pods cost 400m, news 300m. Try `kubectl scale deployment/arcade --replicas=2` — 2×400+2×300=1400m fits. Zero Pending pods is the goal.",
      check: (ctx) =>
        ctx.tick > SECOND_NODE_DOWN_AT &&
        deploymentHealthy(ctx.cluster, "hospital", 5) &&
        deploymentHealthy(ctx.cluster, "traffic-lights", 2) &&
        noPendingPods(ctx.cluster),
    },
    {
      id: "rebuild",
      title: "Rebuild after the storm",
      description:
        "Sigrid has passed and both nodes are Ready again. Uncordon them and restore the town: arcade back to 5, news-site to 2, everything green, nothing Pending.",
      points: 300,
      hint: "`kubectl uncordon worker-3`, `kubectl uncordon worker-4`, then scale arcade back to 5 (and news-site to 2 if you shrank it).",
      check: (ctx) =>
        ctx.tick > STORM_PASSES_AT &&
        nodeBackInService(ctx.cluster, "worker-3") &&
        nodeBackInService(ctx.cluster, "worker-4") &&
        deploymentHealthy(ctx.cluster, "hospital", 5) &&
        deploymentHealthy(ctx.cluster, "traffic-lights", 2) &&
        deploymentHealthy(ctx.cluster, "arcade", 5) &&
        deploymentHealthy(ctx.cluster, "news-site", 2) &&
        noPendingPods(ctx.cluster),
    },
  ],
  events: [
    {
      atTick: STORM_WARNING_AT,
      title: "🌩️ Storm Warning",
      speaker: "weather",
      story:
        "Sirens across the island: Storm Sigrid makes landfall in minutes. The power company can't guarantee all four worker buildings. Get your triage plan ready — hospital first, always.",
    },
    {
      atTick: FIRST_NODE_DOWN_AT,
      title: "⚡ Direct hit: worker-3",
      speaker: "kublet",
      story:
        "BZZT-KRAKOW! Lightning just split the roof of worker-3! The building is dark and every pod inside is unreachable. Drain it — and don't assume the storm is done with you.",
      mutate: (c) => failNode(c, "worker-3"),
    },
    {
      atTick: SECOND_NODE_DOWN_AT,
      title: "🌊 Flood: worker-4",
      speaker: "weather",
      story:
        "The storm surge flooded worker-4's basement. Two workers remain for the whole town. Capacity math time: keep the hospital and traffic lights alive, even if the arcade goes dark tonight.",
      mutate: (c) => failNode(c, "worker-4"),
    },
    {
      atTick: STORM_PASSES_AT,
      title: "🌅 The storm passes",
      speaker: "power",
      story:
        "Sigrid spins out to sea! Repair crews just brought worker-3 and worker-4 back online — both report Ready, both still cordoned. Rebuild the town to full strength.",
      mutate: (c) => {
        recoverNode(c, "worker-3");
        recoverNode(c, "worker-4");
      },
    },
  ],
};

export default level5;
