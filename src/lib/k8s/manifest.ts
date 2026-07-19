/**
 * YAML manifests for the simulator: `kubectl apply -f` and `kubectl edit`.
 *
 * Parsing is real YAML (the `yaml` package) and validation mirrors the
 * errors the actual API server gives — selector/template label mismatches,
 * non-integer replicas, missing required fields — so the lessons transfer.
 */

import { parseAllDocuments } from "yaml";
import { stringify } from "yaml";
import { addEvent, rolloutDeployment } from "./engine";
import type { Cluster, K8sConfigMap, K8sDeployment, K8sSecret, K8sService } from "./types";

export class ManifestError extends Error {}

/* --------------------------- small validators ------------------------- */

const NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

function req<T>(v: T | undefined | null, path: string): T {
  if (v === undefined || v === null) throw new ManifestError(`error validating data: missing required field "${path}"`);
  return v;
}

function validName(v: unknown, path: string): string {
  const s = req(v, path);
  if (typeof s !== "string" || !NAME_RE.test(s)) {
    throw new ManifestError(`The ${path} "${String(s)}" is invalid: a lowercase RFC 1123 name is required (e.g. "my-app")`);
  }
  return s;
}

function parseCpu(v: unknown): number {
  if (v === undefined) return 250;
  const s = String(v);
  const m = s.match(/^(\d+)m$/);
  if (m) return parseInt(m[1], 10);
  const n = Number(s);
  if (!isNaN(n) && n > 0 && n <= 8) return Math.round(n * 1000);
  throw new ManifestError(`quantities must match the regular expression: cpu "${s}" is not valid (use e.g. "250m")`);
}

function parseMem(v: unknown): number {
  if (v === undefined) return 256;
  const s = String(v);
  const m = s.match(/^(\d+)(Mi|Gi)$/);
  if (!m) throw new ManifestError(`quantities must match the regular expression: memory "${s}" is not valid (use e.g. "256Mi")`);
  return m[2] === "Gi" ? parseInt(m[1], 10) * 1024 : parseInt(m[1], 10);
}

/* eslint-disable @typescript-eslint/no-explicit-any -- parsed YAML is untyped */

/* ------------------------------ Deployment ---------------------------- */

function applyDeployment(cluster: Cluster, doc: any): string {
  const name = validName(doc?.metadata?.name, "metadata.name");
  const spec = req(doc.spec, "spec");

  const replicasRaw = spec.replicas ?? 1;
  if (typeof replicasRaw !== "number" || !Number.isInteger(replicasRaw)) {
    throw new ManifestError(
      `error validating "${name}": spec.replicas: invalid value "${String(replicasRaw)}": must be an integer (did someone write it in words?)`
    );
  }
  if (replicasRaw < 0 || replicasRaw > 20) {
    throw new ManifestError(`error validating "${name}": spec.replicas must be between 0 and 20`);
  }

  const selectorApp = req(spec.selector?.matchLabels?.app, "spec.selector.matchLabels.app") as string;
  const labelApp = req(spec.template?.metadata?.labels?.app, "spec.template.metadata.labels.app") as string;
  if (selectorApp !== labelApp) {
    throw new ManifestError(
      `The Deployment "${name}" is invalid: spec.selector: "matchLabels.app=${selectorApp}" does not match template labels "app=${labelApp}" — the selector must match the pod template's labels`
    );
  }

  const containers = req(spec.template?.spec?.containers, "spec.template.spec.containers");
  if (!Array.isArray(containers) || containers.length === 0) {
    throw new ManifestError(`error validating "${name}": spec.template.spec.containers must contain at least one container`);
  }
  const c = containers[0];
  validName(c?.name, "containers[0].name");
  const image = req(c?.image, "containers[0].image") as string;

  const cpu = parseCpu(c?.resources?.requests?.cpu);
  const memory = parseMem(c?.resources?.requests?.memory);
  const containerPort = c?.ports?.[0]?.containerPort ?? 8080;
  const probePortRaw = c?.readinessProbe?.httpGet?.port;
  const probePort = probePortRaw === undefined ? undefined : Number(probePortRaw);

  let configRef: { name: string; key: string } | undefined;
  const envEntry = Array.isArray(c?.env)
    ? c.env.find((e: any) => e?.valueFrom?.configMapKeyRef)
    : undefined;
  if (envEntry) {
    configRef = {
      name: req(envEntry.valueFrom.configMapKeyRef.name, "env.valueFrom.configMapKeyRef.name") as string,
      key: req(envEntry.valueFrom.configMapKeyRef.key, "env.valueFrom.configMapKeyRef.key") as string,
    };
  }

  let secretRef: { name: string; key: string } | undefined;
  const secretEnvEntry = Array.isArray(c?.env)
    ? c.env.find((e: any) => e?.valueFrom?.secretKeyRef)
    : undefined;
  if (secretEnvEntry) {
    secretRef = {
      name: req(secretEnvEntry.valueFrom.secretKeyRef.name, "env.valueFrom.secretKeyRef.name") as string,
      key: req(secretEnvEntry.valueFrom.secretKeyRef.key, "env.valueFrom.secretKeyRef.key") as string,
    };
  }

  const existing = cluster.deployments.find((d) => d.name === name);
  if (existing) {
    const podSpecChanged =
      existing.image !== image ||
      existing.containerPort !== containerPort ||
      existing.probePort !== probePort ||
      JSON.stringify(existing.configRef) !== JSON.stringify(configRef) ||
      JSON.stringify(existing.secretRef) !== JSON.stringify(secretRef) ||
      existing.cpuPerPod !== cpu ||
      existing.memPerPod !== memory;
    if (existing.image !== image) existing.previousImage = existing.image;
    existing.replicas = replicasRaw;
    existing.image = image;
    existing.app = labelApp;
    existing.cpuPerPod = cpu;
    existing.memPerPod = memory;
    existing.containerPort = containerPort;
    existing.probePort = probePort;
    existing.configRef = configRef;
    existing.secretRef = secretRef;
    if (podSpecChanged) rolloutDeployment(cluster, existing);
    addEvent(cluster, "Normal", `deployment/${name}`, "Configured via apply");
    return `deployment.apps/${name} configured`;
  }

  const d: K8sDeployment = {
    name,
    replicas: replicasRaw,
    image,
    app: labelApp,
    cpuPerPod: cpu,
    memPerPod: memory,
    containerPort,
    probePort,
    configRef,
    secretRef,
  };
  cluster.deployments.push(d);
  addEvent(cluster, "Normal", `deployment/${name}`, "Created via apply");
  return `deployment.apps/${name} created`;
}

/* ------------------------------- Service ------------------------------ */

function applyService(cluster: Cluster, doc: any): string {
  const name = validName(doc?.metadata?.name, "metadata.name");
  const spec = req(doc.spec, "spec");
  const selectorApp = req(spec.selector?.app, "spec.selector.app") as string;
  const port = Number(req(spec.ports?.[0]?.port, "spec.ports[0].port"));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ManifestError(`The Service "${name}" is invalid: spec.ports[0].port must be a valid port number`);
  }
  const existing = cluster.services.find((s) => s.name === name);
  if (existing) {
    existing.selectorApp = selectorApp;
    existing.port = port;
    addEvent(cluster, "Normal", `service/${name}`, "Configured via apply");
    return `service/${name} configured`;
  }
  const svc: K8sService = { name, selectorApp, port };
  cluster.services.push(svc);
  addEvent(cluster, "Normal", `service/${name}`, "Created via apply");
  return `service/${name} created`;
}

/* ------------------------------ ConfigMap ----------------------------- */

function applyConfigMap(cluster: Cluster, doc: any): string {
  const name = validName(doc?.metadata?.name, "metadata.name");
  const data = doc?.data ?? {};
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new ManifestError(`The ConfigMap "${name}" is invalid: data must be a map of string keys to string values`);
  }
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) clean[k] = String(v);
  const existing = cluster.configMaps.find((c) => c.name === name);
  if (existing) {
    existing.data = clean;
    addEvent(cluster, "Normal", `configmap/${name}`, "Configured via apply");
    return `configmap/${name} configured`;
  }
  const cm: K8sConfigMap = { name, data: clean };
  cluster.configMaps.push(cm);
  addEvent(cluster, "Normal", `configmap/${name}`, "Created via apply");
  return `configmap/${name} created`;
}

/* ------------------------------- Secret ------------------------------- */

function decodeBase64(value: string): string {
  try {
    return atob(value);
  } catch {
    return value; // not valid base64 — keep as-is, the game is forgiving
  }
}

function applySecret(cluster: Cluster, doc: any): string {
  const name = validName(doc?.metadata?.name, "metadata.name");
  const stringData = doc?.stringData ?? {};
  const data = doc?.data ?? {};
  for (const d of [stringData, data]) {
    if (typeof d !== "object" || Array.isArray(d)) {
      throw new ManifestError(`The Secret "${name}" is invalid: data must be a map of string keys to string values`);
    }
  }
  // Real secrets carry base64 in `data`; `stringData` is the plain-text
  // convenience field. Store everything decoded.
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) clean[k] = decodeBase64(String(v));
  for (const [k, v] of Object.entries(stringData)) clean[k] = String(v);
  const existing = cluster.secrets.find((s) => s.name === name);
  if (existing) {
    existing.data = clean;
    addEvent(cluster, "Normal", `secret/${name}`, "Configured via apply");
    return `secret/${name} configured`;
  }
  const sec: K8sSecret = { name, data: clean };
  cluster.secrets.push(sec);
  addEvent(cluster, "Normal", `secret/${name}`, "Created via apply");
  return `secret/${name} created`;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/* ------------------------------ applyYaml ----------------------------- */

/**
 * Apply a (possibly multi-document) YAML string to the cluster.
 * Throws ManifestError with a kubectl-style message on the first problem.
 * @param mustMatch restrict the edit to one resource (kubectl edit semantics)
 */
export function applyYaml(
  cluster: Cluster,
  text: string,
  mustMatch?: { kind: string; name: string }
): string {
  const docs = parseAllDocuments(text);
  if (docs.length === 0) throw new ManifestError("error: no objects passed to apply");
  const results: string[] = [];
  for (const parsed of docs) {
    if (parsed.errors.length > 0) {
      throw new ManifestError(`error parsing YAML: ${parsed.errors[0].message.split("\n")[0]}`);
    }
    const doc = parsed.toJS();
    if (doc === null || doc === undefined) continue;
    const kind = req(doc.kind, "kind") as string;
    if (mustMatch) {
      if (kind !== mustMatch.kind || doc?.metadata?.name !== mustMatch.name) {
        throw new ManifestError(
          `error: you may not change the kind or name while editing ${mustMatch.kind.toLowerCase()}/${mustMatch.name}`
        );
      }
    }
    switch (kind) {
      case "Deployment":
        results.push(applyDeployment(cluster, doc));
        break;
      case "Service":
        results.push(applyService(cluster, doc));
        break;
      case "ConfigMap":
        results.push(applyConfigMap(cluster, doc));
        break;
      case "Secret":
        results.push(applySecret(cluster, doc));
        break;
      default:
        throw new ManifestError(`error: the simulator doesn't support kind "${kind}" (Deployment, Service, ConfigMap and Secret are available)`);
    }
  }
  if (results.length === 0) throw new ManifestError("error: no objects passed to apply");
  return results.join("\n");
}

/* --------------------------- resource → YAML -------------------------- */

export function deploymentToYaml(d: K8sDeployment): string {
  const container: Record<string, unknown> = {
    name: d.name.split("-")[0] || d.name,
    image: d.image,
    ports: [{ containerPort: d.containerPort ?? 8080 }],
    resources: { requests: { cpu: `${d.cpuPerPod}m`, memory: `${d.memPerPod}Mi` } },
  };
  if (d.probePort !== undefined) {
    container.readinessProbe = { httpGet: { path: "/healthz", port: d.probePort } };
  }
  const env: unknown[] = [];
  if (d.configRef) {
    env.push({
      name: d.configRef.key.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase(),
      valueFrom: { configMapKeyRef: { name: d.configRef.name, key: d.configRef.key } },
    });
  }
  if (d.secretRef) {
    env.push({
      name: d.secretRef.key.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase(),
      valueFrom: { secretKeyRef: { name: d.secretRef.name, key: d.secretRef.key } },
    });
  }
  if (env.length > 0) container.env = env;
  return stringify({
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name: d.name },
    spec: {
      replicas: d.replicas,
      selector: { matchLabels: { app: d.app } },
      template: {
        metadata: { labels: { app: d.app } },
        spec: { containers: [container] },
      },
    },
  });
}

export function serviceToYaml(s: K8sService): string {
  return stringify({
    apiVersion: "v1",
    kind: "Service",
    metadata: { name: s.name },
    spec: { selector: { app: s.selectorApp }, ports: [{ port: s.port }] },
  });
}

export function secretToYaml(s: K8sSecret): string {
  return stringify({
    apiVersion: "v1",
    kind: "Secret",
    metadata: { name: s.name },
    type: "Opaque",
    // Shown as stringData so the editor stays human-readable.
    stringData: s.data,
  });
}

export function configMapToYaml(cm: K8sConfigMap): string {
  return stringify({
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: { name: cm.name },
    data: cm.data,
  });
}
