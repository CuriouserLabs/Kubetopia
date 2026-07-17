import {
  emptyCluster,
  makeDeployment,
  makeNode,
  rolloutDeployment,
} from "../k8s/engine";
import { deploymentHealthy, noPendingPods, ranCommand } from "./helpers";
import type { LevelDef } from "./types";

const BAD_DEPLOY_AT = 20;
const ANALYTICS_SPREE_AT = 70;

/**
 * Level 4 — the cursed deploy. A bad release to fix with rollout undo, then
 * a capacity crunch: more requested CPU than the cluster has, pods Pending,
 * and some honest arithmetic to do.
 */
const level4: LevelDef = {
  id: 4,
  slug: "the-cursed-deploy",
  name: "The Cursed Deploy",
  tagline: "Marketing shipped payments 3.0 on launch day. Of course they did.",
  skills: ["rollout undo (rollbacks)", "resource requests & capacity math", "unschedulable Pending pods"],
  story: [
    {
      speaker: "mayor",
      text: "Kubetopia has gone commercial! The island's shops now share one payment platform, and today is the launch of the Grand Bazaar — every merchant online at once. Do NOT let this become a headline.",
    },
    {
      text: "The war room (the bakery's back office) has three whiteboards, two of them already covered in arrows. Your cluster: two worker buildings, 2000m CPU each. Every pod requests its share — when the requests don't fit, pods go Pending and wait forever.",
    },
    {
      speaker: "mentor",
      text: "Two things always happen on launch day: someone ships an untested release, and someone decides they need 'just a few more replicas'. Keep `kubectl rollout undo` polished and your capacity math sharp.",
    },
  ],
  outro:
    "Payments hum, the analytics team got their (reasonably sized) dashboards, and the Grand Bazaar's first day closes with record sales. The whiteboards have been wiped. For now.",
  parTicks: 200,
  buildCluster: () => {
    const c = emptyCluster();
    c.nodes.push(
      makeNode("control-plane", { roles: "control-plane" }),
      makeNode("worker-1", { cpuCapacity: 2000, memCapacity: 4096 }),
      makeNode("worker-2", { cpuCapacity: 2000, memCapacity: 4096 })
    );
    c.registry = {
      "payments:2.7": { exists: true, logs: ["payments 2.7: transactions flowing", "fraud checks: enabled"] },
      "payments:3.0": {
        exists: true,
        crashes: true,
        logs: [
          "payments 3.0 'Money Cannon' starting...",
          "FATAL: config key 'ledger.url' renamed to 'ledger.endpoint' — no value found",
          "process exited with code 1",
        ],
      },
      "checkout:5.5": { exists: true, logs: ["checkout 5.5: carts rolling"] },
      "analytics:1.9": { exists: true, logs: ["analytics 1.9: crunching festival numbers"] },
    };
    c.deployments.push(
      makeDeployment("payments", { replicas: 3, image: "payments:2.7", critical: true }),
      makeDeployment("checkout", { replicas: 2, image: "checkout:5.5" }),
      makeDeployment("analytics", { replicas: 2, image: "analytics:1.9", cpuPerPod: 400, memPerPod: 512 })
    );
    c.services.push(
      { name: "payments-svc", selectorApp: "payments", port: 443 },
      { name: "checkout-svc", selectorApp: "checkout", port: 80 },
      { name: "analytics-svc", selectorApp: "analytics", port: 80 }
    );
    return c;
  },
  objectives: [
    {
      id: "diagnose",
      title: "Autopsy the Money Cannon",
      description:
        "payments 3.0 is crash-looping and merchants can't sell. Read the logs — know what broke before you touch it.",
      points: 150,
      hint: "After the bad deploy lands: `kubectl get pods`, then `kubectl logs <payments-pod>`.",
      check: (ctx) =>
        ranCommand(ctx, /kubectl\s+(logs|describe\s+(po|pod|pods))\s+payments-/, BAD_DEPLOY_AT),
    },
    {
      id: "rollback",
      title: "Undo the cursed deploy",
      description:
        "There's no time to fix 3.0's config today. Roll payments back to the version that worked and get all 3 replicas Ready.",
      points: 300,
      hint: "Run `kubectl rollout undo deployment/payments` — it flips back to the previous image.",
      check: (ctx) => {
        const d = ctx.cluster.deployments.find((x) => x.name === "payments");
        return !!d && !ctx.cluster.registry[d.image]?.crashes && deploymentHealthy(ctx.cluster, "payments", 3);
      },
    },
    {
      id: "capacity",
      title: "Tame the analytics land-grab",
      description:
        "Analytics scaled themselves to 8 pods × 400m CPU and the scheduler is drowning in Pending. Do the math (2 workers × 2000m) and right-size them — the team needs at least 5 replicas actually Running.",
      points: 350,
      hint: "Total worker CPU is 4000m; payments+checkout use 1250m. 8×400m won't fit — `kubectl scale deployment/analytics --replicas=5` (or 6) fits. Then wait for Pending to clear.",
      check: (ctx) => {
        const d = ctx.cluster.deployments.find((x) => x.name === "analytics");
        return (
          !!d && d.replicas >= 5 && ctx.tick > ANALYTICS_SPREE_AT &&
          deploymentHealthy(ctx.cluster, "analytics", 5) &&
          noPendingPods(ctx.cluster)
        );
      },
    },
    {
      id: "steady",
      title: "Close the launch day green",
      description:
        "Every deployment at full strength, zero Pending pods, war-room whiteboards wiped.",
      points: 200,
      hint: "All of payments (3), checkout (2) and analytics (5+) Ready, with no Pending pods left.",
      check: (ctx) =>
        deploymentHealthy(ctx.cluster, "payments", 3) &&
        deploymentHealthy(ctx.cluster, "checkout", 2) &&
        deploymentHealthy(ctx.cluster, "analytics", 5) &&
        noPendingPods(ctx.cluster),
    },
  ],
  events: [
    {
      atTick: BAD_DEPLOY_AT,
      title: "🚀 Marketing strikes",
      speaker: "marketing",
      story:
        "Big news, big news! We just shipped payments 3.0 'Money Cannon' to production for the launch! It's — okay, it is not firing money. Every payments pod is crashing and the merchants are lighting torches. Little help?",
      mutate: (c) => {
        const d = c.deployments.find((x) => x.name === "payments");
        if (!d) return;
        d.previousImage = d.image;
        d.image = "payments:3.0";
        rolloutDeployment(c, d);
      },
    },
    {
      atTick: ANALYTICS_SPREE_AT,
      title: "📊 Analytics goes shopping",
      speaker: "analytics",
      story:
        "We needed more dashboards, so we scaled ourselves to EIGHT pods at 400m CPU each. The cluster physically cannot hold that — pods are piling up Pending. ...In hindsight, the math was available to us.",
      mutate: (c) => {
        const d = c.deployments.find((x) => x.name === "analytics");
        if (d) d.replicas = 8;
      },
    },
  ],
};

export default level4;
