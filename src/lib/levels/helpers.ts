import { podStartupIssue, readyPodsOf } from "../k8s/engine";
import type { Cluster } from "../k8s/types";
import type { CheckCtx, ScriptedEvent } from "./types";

/** True if the player ran a command matching `re` at or after `sinceTick`.
 *  The console accepts `k` as a shortcut for `kubectl`, so objective regexes
 *  (which are written against `kubectl ...`) must match either spelling. */
export function ranCommand(ctx: CheckCtx, re: RegExp, sinceTick = 0): boolean {
  return ctx.commands.some(
    (c) => c.ok !== false && c.tick >= sinceTick && re.test(c.raw.replace(/^k(?=\s)/, "kubectl"))
  );
}

/**
 * Should this scripted event fire now? Either its clock time has come, or the
 * player already finished the objective it follows (plus a short beat).
 * Shared by gameStore.stepTick and the test harness so they cannot drift.
 */
export function eventDue(
  ev: ScriptedEvent,
  tick: number,
  completedAt: Record<string, number>
): boolean {
  if (tick >= ev.atTick) return true;
  if (ev.afterObjective === undefined) return false;
  const doneAt = completedAt[ev.afterObjective];
  return doneAt !== undefined && tick >= doneAt + (ev.afterDelay ?? 5);
}

/** True when the deployment's readiness probe targets the port the app really
 *  listens on (or it has no probe). */
export function probeHealthy(cluster: Cluster, name: string): boolean {
  return !podStartupIssue(cluster, name).probeBroken;
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
