/**
 * Core types for the simulated Kubernetes cluster.
 * The simulation is tick-based: one tick ~= one real second of game time.
 */

export type PodPhase =
  | "Pending"
  | "ContainerCreating"
  | "Running"
  | "CrashLoopBackOff"
  | "ImagePullBackOff"
  | "Terminating"
  | "Unknown";

export interface K8sPod {
  uid: string;
  name: string;
  /** Name of the owning deployment, if any. */
  owner?: string;
  nodeName?: string;
  phase: PodPhase;
  ready: boolean;
  restarts: number;
  image: string;
  /** Requested millicores. */
  cpu: number;
  /** Requested memory in Mi. */
  memory: number;
  labels: Record<string, string>;
  createdAtTick: number;
  /** Ticks spent in the current phase. */
  phaseTicks: number;
  /** Remaining backoff ticks while in CrashLoopBackOff. */
  backoff: number;
}

export interface K8sNode {
  name: string;
  status: "Ready" | "NotReady";
  cordoned: boolean;
  roles: "control-plane" | "worker";
  /** Allocatable millicores. */
  cpuCapacity: number;
  /** Allocatable memory in Mi. */
  memCapacity: number;
  notReadySinceTick?: number;
}

export interface K8sDeployment {
  name: string;
  /** Desired replica count. */
  replicas: number;
  image: string;
  previousImage?: string;
  cpuPerPod: number;
  memPerPod: number;
  /** Value of the `app` label stamped onto pods. */
  app: string;
  /** Critical workloads weigh more in the town-happiness score. */
  critical?: boolean;
  /** Port the container actually listens on (default 8080). */
  containerPort?: number;
  /** Readiness probe port; if set and ≠ containerPort, pods never go Ready. */
  probePort?: number;
  /** Required config: pod crashes at startup if the map/key is missing. */
  configRef?: { name: string; key: string };
}

export interface K8sConfigMap {
  name: string;
  data: Record<string, string>;
}

export interface K8sService {
  name: string;
  /** The `app` label this service selects. A typo here = outage. */
  selectorApp: string;
  port: number;
}

export interface ImageInfo {
  /** Image exists in the registry (pullable). */
  exists: boolean;
  /** Container starts but keeps crashing. */
  crashes?: boolean;
  /** Log lines shown by `kubectl logs` for pods running this image. */
  logs?: string[];
}

export interface ClusterEvent {
  tick: number;
  type: "Normal" | "Warning";
  object: string;
  message: string;
}

export interface Cluster {
  tick: number;
  nodes: K8sNode[];
  pods: K8sPod[];
  deployments: K8sDeployment[];
  services: K8sService[];
  configMaps: K8sConfigMap[];
  events: ClusterEvent[];
  /** Simulated container registry keyed by image ref. */
  registry: Record<string, ImageInfo>;
}
