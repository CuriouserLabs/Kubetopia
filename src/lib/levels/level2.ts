import { emptyCluster, makeDeployment, makeNode } from "../k8s/engine";
import { deploymentHealthy, ranCommand } from "./helpers";
import type { LevelDef } from "./types";

/**
 * Level 2 — services and selectors. A label typo takes ticket sales offline
 * (a painfully real production incident), plus an ImagePullBackOff from a
 * fat-fingered tag, plus scaling for a traffic surge.
 */
const level2: LevelDef = {
  id: 2,
  slug: "festival-fiasco",
  name: "The Grand Festival Fiasco",
  tagline: "Ticket sales are dead, the posters are blank, and the band arrives at dawn.",
  skills: ["Services & label selectors", "fixing an ImagePullBackOff", "capacity for traffic surges"],
  story: [
    {
      speaker: "crier",
      text: "HEAR YE! Kubetopia's Grand Festival is tomorrow! The whole island is buzzing — string lights between the node-buildings, a stage by the gateway tower, the works!",
    },
    {
      speaker: "committee",
      text: "One problem, darling: nobody can buy tickets. The ticket-shop pods look perfectly healthy, yet the ticket website returns nothing. Somewhere between the Service and the pods, traffic is falling into the sea.",
    },
    {
      speaker: "intern",
      text: "Um. Also. I deployed a new poster-maker last night and now it... can't even start? And when tickets DO come back online — half the island is going to hit 'buy' at once. Sorry in advance.",
    },
    {
      speaker: "mentor",
      text: "Hint from an old-timer: when healthy pods get no traffic, compare the Service's selector with the pods' labels. `kubectl get svc` and `kubectl get pods -o wide` are your friends.",
    },
  ],
  outro:
    "Tickets sold out in minutes, the posters are gorgeous, and the band opened with a song about high availability. The festival is saved — you're becoming a bit of a local legend.",
  parTicks: 150,
  buildCluster: () => {
    const c = emptyCluster();
    c.nodes.push(
      makeNode("control-plane", { roles: "control-plane" }),
      makeNode("worker-1"),
      makeNode("worker-2"),
      makeNode("worker-3")
    );
    c.registry = {
      "ticket-shop:3.2": {
        exists: true,
        logs: ["ticket-shop 3.2 up", "listening on :8080", "0 requests served (is anyone out there?)"],
      },
      "poster-maker:2.0": {
        exists: true,
        logs: ["poster-maker 2.0", "rendering festival posters at :8080"],
      },
      // poster-maker:2.1 deliberately absent from the registry (typo tag)
      "band-website:1.0": { exists: true, logs: ["band-website: now playing — 99 Bugs in the Code"] },
    };
    c.deployments.push(
      makeDeployment("ticket-shop", { replicas: 2, image: "ticket-shop:3.2" }),
      makeDeployment("poster-maker", { replicas: 1, image: "poster-maker:2.1" }),
      makeDeployment("band-website", { replicas: 2, image: "band-website:1.0" })
    );
    c.services.push(
      // The typo that broke ticket sales: selector doesn't match app=ticket-shop
      { name: "ticket-svc", selectorApp: "tikcet-shop", port: 80 },
      { name: "poster-svc", selectorApp: "poster-maker", port: 80 },
      { name: "band-svc", selectorApp: "band-website", port: 80 }
    );
    return c;
  },
  objectives: [
    {
      id: "investigate",
      title: "Follow the missing traffic",
      description:
        "Ticket pods are Running but the site is dead. Inspect the services and compare selectors against pod labels.",
      points: 150,
      hint: "Run `kubectl get svc` — look hard at the SELECTOR column for ticket-svc, then check pod labels with `kubectl get pods -o wide` or `kubectl describe pod`.",
      check: (ctx) => ranCommand(ctx, /kubectl\s+(get|describe)\s+(svc|service|services)\b/),
    },
    {
      id: "fix-selector",
      title: "Reconnect the ticket booth",
      description:
        "Someone fat-fingered the ticket-svc selector. Patch it so it matches the ticket-shop pods' label again.",
      points: 250,
      hint: `Run: kubectl patch service ticket-svc -p '{"spec":{"selector":{"app":"ticket-shop"}}}'`,
      check: (ctx) => {
        const svc = ctx.cluster.services.find((s) => s.name === "ticket-svc");
        return svc?.selectorApp === "ticket-shop" && deploymentHealthy(ctx.cluster, "ticket-shop", 2);
      },
    },
    {
      id: "fix-image",
      title: "Un-blank the posters",
      description:
        "poster-maker is stuck in ImagePullBackOff — the tag the intern pushed doesn't exist. Point it at a tag that does.",
      points: 250,
      hint: "Describe the pod to see the bad tag, then `kubectl set image deployment/poster-maker poster-maker=poster-maker:2.0`.",
      check: (ctx) => {
        const d = ctx.cluster.deployments.find((x) => x.name === "poster-maker");
        return !!d && ctx.cluster.registry[d.image]?.exists === true && deploymentHealthy(ctx.cluster, "poster-maker", 1);
      },
    },
    {
      id: "surge",
      title: "Survive the ticket stampede",
      description:
        "Tickets are live and the whole island is refreshing the page. Scale ticket-shop to 6 replicas, all Ready.",
      points: 250,
      hint: "Run `kubectl scale deployment/ticket-shop --replicas=6` and wait for 6/6 Ready.",
      check: (ctx) => deploymentHealthy(ctx.cluster, "ticket-shop", 6),
    },
  ],
  events: [
    {
      atTick: 40,
      title: "🎪 Festival Committee",
      speaker: "committee",
      story:
        "The posters are BLANK, darling. Blank! The intern says the new poster-maker won't start. Fix it or the festival has no faces!",
    },
    {
      atTick: 80,
      title: "📈 Traffic Watch",
      speaker: "kublet",
      story:
        "Beep-beep-BEEP! The gateway tower is glowing — ticket demand is spiking beyond anything Kubetopia has seen. Two replicas will never hold. Scale up before the stampede!",
    },
  ],
};

export default level2;
