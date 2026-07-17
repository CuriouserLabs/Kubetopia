import { readyPodsOf } from "../k8s/engine";
import type { Cluster } from "../k8s/types";
import type { CheckCtx } from "./types";

/** True if the player ran a command matching `re` at or after `sinceTick`. */
export function ranCommand(ctx: CheckCtx, re: RegExp, sinceTick = 0): boolean {
  return ctx.commands.some((c) => c.tick >= sinceTick && re.test(c.raw));
}

/** True if a deployment has all desired replicas ready (and at least `min`). */
export function deploymentHealthy(
  cluster: Cluster,
  name: string,
  min = 1
): boolean {
  const d = cluster.deployments.find((x) => x.name === name);
  if (!d) return false;
  const ready = readyPodsOf(cluster, name).length;
  return d.replicas >= min && ready >= d.replicas;
}

export function noPendingPods(cluster: Cluster): boolean {
  return !cluster.pods.some((p) => p.phase === "Pending");
}

export function nodeDrained(cluster: Cluster, name: string): boolean {
  const n = cluster.nodes.find((x) => x.name === name);
  if (!n || !n.cordoned) return false;
  return !cluster.pods.some(
    (p) => p.nodeName === name && p.phase !== "Terminating"
  );
}

export function nodeBackInService(cluster: Cluster, name: string): boolean {
  const n = cluster.nodes.find((x) => x.name === name);
  return !!n && n.status === "Ready" && !n.cordoned;
}
