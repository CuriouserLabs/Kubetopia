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
  | "CreateContainerConfigError"
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
  /** Name of the single container in the pod template. When unset, the first
   *  dash-separated word of the deployment name is used (see containerNameOf). */
  containerName?: string;
  /** Declared containerPort. Informational only, exactly like real Kubernetes:
   *  the port the app REALLY listens on is ImageInfo.listenPort. */
  containerPort?: number;
  /** Readiness probe port; if set and ≠ the image's listenPort, pods never go Ready. */
  probePort?: number;
  /** Env var sourced from a ConfigMap key (see KeyRef for the failure modes). */
  configRef?: KeyRef;
  /** Env var sourced from a Secret key (see KeyRef for the failure modes). */
  secretRef?: KeyRef;
}

/**
 * An `env[].valueFrom.configMapKeyRef` / `secretKeyRef` reference.
 * When the object or the key is missing, real Kubernetes does one of two things:
 *  - `optional` unset/false: the container is never created. The pod sits in
 *    `CreateContainerConfigError` (0 restarts, no logs) until the reference resolves.
 *  - `optional: true`: the container starts WITHOUT the variable. An app that
 *    really needs it then exits, giving `CrashLoopBackOff` with the reason in its logs.
 */
export interface KeyRef {
  name: string;
  key: string;
  optional?: boolean;
}

export interface K8sConfigMap {
  name: string;
  data: Record<string, string>;
}

export interface K8sSecret {
  name: string;
  /** Stored decoded; kubectl output never prints the values. */
  data: Record<string, string>;
}

export interface K8sService {
  name: string;
  /** The `app` label this service selects. A typo here = outage. */
  selectorApp: string;
  port: number;
  /** Pod port the service forwards to. Undefined (services built in level
   *  code) means 8080. Services applied from YAML default it to `port`, like
   *  the real API server. Must equal the image's listenPort to serve traffic. */
  targetPort?: number;
}

export interface ImageInfo {
  /** Image exists in the registry (pullable). */
  exists: boolean;
  /** Container starts but keeps crashing. */
  crashes?: boolean;
  /** Log lines shown by `kubectl logs` for pods running this image. */
  logs?: string[];
  /** Port the application inside this image really listens on (default 8080). */
  listenPort?: number;
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
  secrets: K8sSecret[];
  events: ClusterEvent[];
  /** Simulated container registry keyed by image ref. */
  registry: Record<string, ImageInfo>;
}
