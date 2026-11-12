/**
 * The heart of the simulator: a tiny Kubernetes control loop.
 *
 * Every tick the engine, much like real kube controllers, moves the cluster
 * one step closer to the desired state: reconciling deployments, scheduling
 * pending pods onto nodes with free capacity, progressing container
 * lifecycles, and reacting to node failures.
 */

import type {
  Cluster,
  ClusterEvent,
  K8sDeployment,
  K8sNode,
  K8sPod,
  KeyRef,
} from "./types";

/* ------------------------------------------------------------------ */
/* Construction helpers (used by level definitions)                    */
/* ------------------------------------------------------------------ */

/** Random lowercase hex string from the Web Crypto API (browser and Node alike). */
function randomSuffix(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, length);
}

let uidCounter = 0;
const uid = () => `u${(uidCounter++).toString(36)}${randomSuffix(4)}`;

const podSuffix = () => randomSuffix(5);

export function makeNode(
  name: string,
  opts: Partial<K8sNode> = {}
): K8sNode {
  return {
    name,
    status: "Ready",
    cordoned: false,
    roles: "worker",
    cpuCapacity: 2000,
    memCapacity: 4096,
    ...opts,
  };
}

export function makeDeployment(
  name: string,
  opts: Partial<K8sDeployment> = {}
): K8sDeployment {
  return {
    name,
    replicas: 1,
    image: `${name}:1.0`,
    cpuPerPod: 250,
    memPerPod: 256,
    app: name,
    ...opts,
  };
}

export function emptyCluster(): Cluster {
  return {
    tick: 0,
    nodes: [],
    pods: [],
    deployments: [],
    services: [],
    configMaps: [],
    secrets: [],
    events: [],
    registry: {},
  };
}

/**
 * Why a deployment's pods can't start or go Ready — mirrors the two most
 * common "it deployed but it doesn't work" causes in real clusters.
 */
/** A ConfigMap/Secret reference that does not resolve right now. */
export interface MissingRef extends KeyRef {
  /** True when the whole ConfigMap/Secret is absent (not just the key). */
  objectMissing: boolean;
}

export interface StartupIssue {
  configMissing?: MissingRef;
  secretMissing?: MissingRef;
  probeBroken?: boolean;
}

/** Name of the deployment's container (used by `set image` and the YAML view). */
export function containerNameOf(d: K8sDeployment): string {
  return d.containerName ?? (d.name.split("-")[0] || d.name);
}

/** The port the app inside this deployment's image REALLY listens on.
 *  `containerPort` in the manifest is only documentation, as in real Kubernetes. */
export function listenPortOf(cluster: Cluster, d: K8sDeployment): number {
  return cluster.registry[d.image]?.listenPort ?? 8080;
}

export function podStartupIssue(
  cluster: Cluster,
  deploymentName: string | undefined
): StartupIssue {
  const d = cluster.deployments.find((x) => x.name === deploymentName);
  if (!d) return {};
  const issue: StartupIssue = {};
  if (d.configRef) {
    const cm = cluster.configMaps.find((c) => c.name === d.configRef!.name);
    if (!cm || !(d.configRef.key in cm.data)) {
      issue.configMissing = { ...d.configRef, objectMissing: !cm };
    }
  }
  if (d.secretRef) {
    const sec = cluster.secrets.find((s) => s.name === d.secretRef!.name);
    if (!sec || !(d.secretRef.key in sec.data)) {
      issue.secretMissing = { ...d.secretRef, objectMissing: !sec };
    }
  }
  if (d.probePort !== undefined && d.probePort !== listenPortOf(cluster, d)) {
    issue.probeBroken = true;
  }
  return issue;
}

/**
 * The kubelet's error when a NON-optional reference blocks container creation
 * (pod status `CreateContainerConfigError`). Undefined when nothing blocks.
 * Wording matches the real kubelet so the lesson transfers.
 */
export function configErrorMessage(issue: StartupIssue): string | undefined {
  const c = issue.configMissing;
  if (c && !c.optional) {
    return c.objectMissing
      ? `configmap "${c.name}" not found`
      : `couldn't find key ${c.key} in ConfigMap default/${c.name}`;
  }
  const s = issue.secretMissing;
  if (s && !s.optional) {
    return s.objectMissing
      ? `secret "${s.name}" not found`
      : `couldn't find key ${s.key} in Secret default/${s.name}`;
  }
  return undefined;
}

/** True when an `optional: true` reference is missing: the container starts,
 *  the app finds its setting absent and exits (CrashLoopBackOff). */
export function crashesOnMissingConfig(issue: StartupIssue): boolean {
  return !!issue.configMissing?.optional || !!issue.secretMissing?.optional;
}

/** Stable fake pod IP (10.244.<node index>.<n>) so kubectl output looks real. */
export function podIP(cluster: Cluster, pod: K8sPod): string {
  if (!pod.nodeName) return "<none>";
  const nodeIdx = Math.max(0, cluster.nodes.findIndex((n) => n.name === pod.nodeName));
  let h = 0;
  for (const ch of pod.uid) h = (h * 31 + ch.charCodeAt(0)) % 250;
  return `10.244.${nodeIdx}.${h + 2}`;
}

export function addEvent(
  cluster: Cluster,
  type: ClusterEvent["type"],
  object: string,
  message: string
) {
  cluster.events.push({ tick: cluster.tick, type, object, message });
  if (cluster.events.length > 60) cluster.events.splice(0, cluster.events.length - 60);
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function podsOf(cluster: Cluster, deployment: string): K8sPod[] {
  return cluster.pods.filter((p) => p.owner === deployment);
}

export function livePodsOf(cluster: Cluster, deployment: string): K8sPod[] {
  return podsOf(cluster, deployment).filter((p) => p.phase !== "Terminating");
}

export function readyPodsOf(cluster: Cluster, deployment: string): K8sPod[] {
  return livePodsOf(cluster, deployment).filter((p) => p.ready);
}

export function nodeUsage(cluster: Cluster, nodeName: string) {
  let cpu = 0;
  let mem = 0;
  for (const p of cluster.pods) {
    if (p.nodeName === nodeName && p.phase !== "Terminating") {
      cpu += p.cpu;
      mem += p.memory;
    }
  }
  return { cpu, mem };
}

/** Fraction (0..1) of desired replicas a service is actually serving. */
export function serviceHealth(cluster: Cluster, svcName: string): number {
  const svc = cluster.services.find((s) => s.name === svcName);
  if (!svc) return 0;
  const deployments = cluster.deployments.filter((d) => d.app === svc.selectorApp);
  if (deployments.length === 0) return 0; // selector matches nothing
  let desired = 0;
  let ready = 0;
  const targetPort = svc.targetPort ?? 8080;
  for (const d of deployments) {
    desired += d.replicas;
    // Traffic only lands if the service forwards to the port the app listens on.
    if (targetPort === listenPortOf(cluster, d)) ready += readyPodsOf(cluster, d.name).length;
  }
  if (desired === 0) return 0;
  return Math.min(1, ready / desired);
}

/* ------------------------------------------------------------------ */
/* Mutations used by kubectl / scripted events                         */
/* ------------------------------------------------------------------ */

export function createPodFor(cluster: Cluster, d: K8sDeployment): K8sPod {
  const pod: K8sPod = {
    uid: uid(),
    name: `${d.name}-${podSuffix()}`,
    owner: d.name,
    phase: "Pending",
    ready: false,
    restarts: 0,
    image: d.image,
    cpu: d.cpuPerPod,
    memory: d.memPerPod,
    labels: { app: d.app },
    createdAtTick: cluster.tick,
    phaseTicks: 0,
    backoff: 0,
  };
  cluster.pods.push(pod);
  return pod;
}

export function terminatePod(cluster: Cluster, pod: K8sPod) {
  if (pod.phase === "Terminating") return;
  pod.phase = "Terminating";
  pod.ready = false;
  pod.phaseTicks = 0;
  addEvent(cluster, "Normal", `pod/${pod.name}`, "Stopping container");
}

/**
 * Roll a deployment. Kubetopia models ONE rollout strategy: `Recreate` — every
 * old pod is stopped, then the new ones are created (so a bad release is a
 * full outage). Real Deployments default to `RollingUpdate`, which keeps old
 * pods serving while new ones prove themselves; that is not simulated, and the
 * YAML view / `describe deployment` say `Recreate` so players are not misled.
 */
export function rolloutDeployment(cluster: Cluster, d: K8sDeployment) {
  for (const p of livePodsOf(cluster, d.name)) terminatePod(cluster, p);
  addEvent(cluster, "Normal", `deployment/${d.name}`, `Rolling out image ${d.image} (strategy: Recreate)`);
}

export function failNode(cluster: Cluster, nodeName: string) {
  const node = cluster.nodes.find((n) => n.name === nodeName);
  if (!node || node.status === "NotReady") return;
  node.status = "NotReady";
  node.notReadySinceTick = cluster.tick;
  addEvent(cluster, "Warning", `node/${node.name}`, "NodeNotReady: kubelet stopped posting status");
}

export function recoverNode(cluster: Cluster, nodeName: string) {
  const node = cluster.nodes.find((n) => n.name === nodeName);
  if (!node || node.status === "Ready") return;
  node.status = "Ready";
  node.notReadySinceTick = undefined;
  addEvent(cluster, "Normal", `node/${node.name}`, "NodeReady: kubelet is posting status again");
}

/* ------------------------------------------------------------------ */
/* The control loop                                                    */
/* ------------------------------------------------------------------ */

const CREATE_TICKS = 2; // ContainerCreating duration
const READY_DELAY = 2; // Running -> ready (readiness probe)
const CRASH_AFTER = 3; // crashing containers run this long before dying
const TERMINATION_TICKS = 3;
const UNKNOWN_AFTER = 4; // pod on a dead node goes Unknown after this
const EVICT_AFTER = 45; // pods on a dead node are force-deleted after this
const IMAGE_RETRY = 6; // ImagePullBackOff retry cadence

function schedulable(cluster: Cluster, pod: K8sPod, node: K8sNode): boolean {
  if (node.status !== "Ready" || node.cordoned) return false;
  if (node.roles === "control-plane") return false;
  const use = nodeUsage(cluster, node.name);
  return (
    use.cpu + pod.cpu <= node.cpuCapacity &&
    use.mem + pod.memory <= node.memCapacity
  );
}

/** Why no node can take this pod, in the real scheduler's wording. */
export function schedulingFailureMessage(cluster: Cluster, pod: K8sPod): string {
  let controlPlane = 0;
  let unreachable = 0;
  let cordoned = 0;
  let cpu = 0;
  let mem = 0;
  for (const n of cluster.nodes) {
    if (n.roles === "control-plane") controlPlane++;
    else if (n.status !== "Ready") unreachable++;
    else if (n.cordoned) cordoned++;
    else {
      const use = nodeUsage(cluster, n.name);
      if (use.cpu + pod.cpu > n.cpuCapacity) cpu++;
      else if (use.mem + pod.memory > n.memCapacity) mem++;
    }
  }
  const reasons: string[] = [];
  if (cpu) reasons.push(`${cpu} Insufficient cpu`);
  if (mem) reasons.push(`${mem} Insufficient memory`);
  if (controlPlane) reasons.push(`${controlPlane} node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }`);
  if (unreachable) reasons.push(`${unreachable} node(s) had untolerated taint {node.kubernetes.io/unreachable: }`);
  if (cordoned) reasons.push(`${cordoned} node(s) were unschedulable`);
  return `0/${cluster.nodes.length} nodes are available: ${reasons.join(", ")}.`;
}

/** Advance the cluster by one tick. Mutates in place. */
export function tick(cluster: Cluster) {
  cluster.tick += 1;

  /* 1 — Deployment reconciliation */
  for (const d of cluster.deployments) {
    const live = livePodsOf(cluster, d.name);
    if (live.length < d.replicas) {
      const missing = d.replicas - live.length;
      for (let i = 0; i < missing; i++) {
        const pod = createPodFor(cluster, d);
        addEvent(cluster, "Normal", `deployment/${d.name}`, `Created pod ${pod.name}`);
      }
    } else if (live.length > d.replicas) {
      // Like the real ReplicaSet controller: remove pods that aren't serving
      // first (unscheduled, then not-Ready), and only then the newest ones.
      const rank = (p: K8sPod) => (p.phase === "Pending" ? 0 : p.ready ? 2 : 1);
      const extra = live
        .slice()
        .sort((a, b) => rank(a) - rank(b) || b.createdAtTick - a.createdAtTick)
        .slice(0, live.length - d.replicas);
      for (const p of extra) terminatePod(cluster, p);
    }
  }

  /* 2 — Scheduler. Critical workloads get first claim on free capacity
     (mirrors pod priority): without this, a non-critical deployment that
     scaled up earlier would permanently starve a critical app's replacement
     pods after a rollback — e.g. level 4's analytics land-grab swallowing
     the capacity freed by payments' own terminating pods. */
  const isCritical = (p: K8sPod) =>
    cluster.deployments.find((d) => d.name === p.owner)?.critical ? 0 : 1;
  const pending = cluster.pods
    .filter((p) => p.phase === "Pending")
    .sort((a, b) => isCritical(a) - isCritical(b) || a.createdAtTick - b.createdAtTick);
  for (const pod of pending) {
    const candidates = cluster.nodes
      .filter((n) => schedulable(cluster, pod, n))
      .sort((a, b) => {
        const ua = nodeUsage(cluster, a.name);
        const ub = nodeUsage(cluster, b.name);
        return ua.cpu / a.cpuCapacity - ub.cpu / b.cpuCapacity;
      });
    if (candidates.length > 0) {
      pod.nodeName = candidates[0].name;
      pod.phase = "ContainerCreating";
      pod.phaseTicks = 0;
      addEvent(cluster, "Normal", `pod/${pod.name}`, `Scheduled onto ${pod.nodeName}`);
    } else if (pod.phaseTicks === 3) {
      addEvent(
        cluster,
        "Warning",
        `pod/${pod.name}`,
        `FailedScheduling: ${schedulingFailureMessage(cluster, pod)}`
      );
    }
  }

  /* 3 — Pod lifecycle */
  for (const pod of cluster.pods) {
    pod.phaseTicks += 1;
    const image = cluster.registry[pod.image];
    const node = cluster.nodes.find((n) => n.name === pod.nodeName);
    const nodeDown = !!node && node.status === "NotReady";

    // Pods on a dead node freeze, go Unknown, and are eventually evicted.
    if (nodeDown && pod.phase !== "Terminating") {
      const downFor = cluster.tick - (node.notReadySinceTick ?? cluster.tick);
      if (downFor >= EVICT_AFTER) {
        addEvent(cluster, "Warning", `pod/${pod.name}`, "TaintManagerEviction: evicting pod from unreachable node");
        pod.phase = "Terminating";
        pod.phaseTicks = TERMINATION_TICKS; // instant removal below
      } else if (downFor >= UNKNOWN_AFTER && pod.phase !== "Unknown") {
        pod.phase = "Unknown";
        pod.ready = false;
        pod.phaseTicks = 0;
      }
      continue;
    }

    switch (pod.phase) {
      case "ContainerCreating": {
        if (pod.phaseTicks < CREATE_TICKS) break;
        if (!image || !image.exists) {
          pod.phase = "ImagePullBackOff";
          pod.phaseTicks = 0;
          addEvent(
            cluster,
            "Warning",
            `pod/${pod.name}`,
            `Failed to pull image "${pod.image}": not found in registry`
          );
        } else {
          const blocked = configErrorMessage(podStartupIssue(cluster, pod.owner));
          if (blocked) {
            // A required (non-optional) ConfigMap/Secret reference is missing:
            // the kubelet cannot even create the container.
            pod.phase = "CreateContainerConfigError";
            pod.phaseTicks = 0;
            addEvent(cluster, "Warning", `pod/${pod.name}`, `Failed: Error: ${blocked}`);
          } else {
            pod.phase = "Running";
            pod.phaseTicks = 0;
            pod.ready = false;
          }
        }
        break;
      }
      case "CreateContainerConfigError": {
        // The kubelet keeps retrying; the pod starts by itself once the
        // reference resolves (no restart needed, restart count stays 0).
        if (!configErrorMessage(podStartupIssue(cluster, pod.owner))) {
          const owner = cluster.deployments.find((d) => d.name === pod.owner);
          if (owner) pod.image = owner.image;
          pod.phase = "ContainerCreating";
          pod.phaseTicks = 0;
        }
        break;
      }
      case "ImagePullBackOff": {
        if (pod.phaseTicks >= IMAGE_RETRY) {
          pod.phase = "ContainerCreating";
          pod.phaseTicks = 0;
          // A pod always retries with its owning deployment's current image
          // (models the rollout that replaced it; keeps the game forgiving).
          const owner = cluster.deployments.find((d) => d.name === pod.owner);
          if (owner) pod.image = owner.image;
        }
        break;
      }
      case "Running": {
        const issue = podStartupIssue(cluster, pod.owner);
        // Only `optional: true` references can crash a running app; a missing
        // NON-optional reference never gets this far (CreateContainerConfigError).
        if (image?.crashes || crashesOnMissingConfig(issue)) {
          pod.ready = false;
          if (pod.phaseTicks >= CRASH_AFTER) {
            pod.restarts += 1;
            pod.phase = "CrashLoopBackOff";
            pod.phaseTicks = 0;
            pod.backoff = Math.min(4 + pod.restarts * 2, 20);
            addEvent(
              cluster,
              "Warning",
              `pod/${pod.name}`,
              `BackOff: Back-off restarting failed container (exit code 1, restart ${pod.restarts}) — see kubectl logs`
            );
          }
        } else if (issue.probeBroken) {
          pod.ready = false;
          if (pod.phaseTicks % 6 === 0) {
            const owner = cluster.deployments.find((d) => d.name === pod.owner);
            addEvent(
              cluster,
              "Warning",
              `pod/${pod.name}`,
              `Readiness probe failed: Get "http://${podIP(cluster, pod)}:${owner?.probePort}/healthz": dial tcp ${podIP(cluster, pod)}:${owner?.probePort}: connect: connection refused`
            );
          }
        } else if (!pod.ready && pod.phaseTicks >= READY_DELAY) {
          pod.ready = true;
          addEvent(cluster, "Normal", `pod/${pod.name}`, "Readiness probe passed");
        }
        break;
      }
      case "CrashLoopBackOff": {
        if (pod.phaseTicks >= pod.backoff) {
          const owner = cluster.deployments.find((d) => d.name === pod.owner);
          if (owner) pod.image = owner.image; // pick up fixed image on restart
          pod.phase = "ContainerCreating";
          pod.phaseTicks = 0;
        }
        break;
      }
      case "Unknown": {
        // Node came back: kubelet reports the pod again.
        if (!nodeDown) {
          pod.phase = "Running";
          pod.phaseTicks = 0;
        }
        break;
      }
    }
  }

  /* 4 — Reap terminated pods */
  for (let i = cluster.pods.length - 1; i >= 0; i--) {
    const pod = cluster.pods[i];
    if (pod.phase === "Terminating" && pod.phaseTicks >= TERMINATION_TICKS) {
      cluster.pods.splice(i, 1);
    }
  }
}
