/**
 * A forgiving kubectl-style command interpreter for the simulator.
 * Supports the real-world subset of commands the missions need, with the
 * genuine syntax (aliases like `po`, `deploy`, `svc` included).
 */

import {
  addEvent,
  configErrorMessage,
  containerNameOf,
  listenPortOf,
  livePodsOf,
  nodeUsage,
  podIP,
  podStartupIssue,
  readyPodsOf,
  rolloutDeployment,
  schedulingFailureMessage,
  terminatePod,
} from "./engine";
import { configMapToYaml, deploymentToYaml, envVarName, secretToYaml, serviceToYaml } from "./manifest";
import type { Cluster, K8sPod, K8sService } from "./types";

/** Request to open the YAML editor modal (kubectl edit / apply -f). */
export interface EditorRequest {
  title: string;
  content: string;
  /** Present when editing a live resource: apply must keep kind+name. */
  resource?: { kind: string; name: string };
  /** Present when the YAML came from a blueprint file: save-back key. */
  filename?: string;
}

export interface CmdResult {
  output: string;
  ok: boolean;
  editor?: EditorRequest;
}

const err = (output: string): CmdResult => ({ output, ok: false });
const out = (output: string): CmdResult => ({ output, ok: true });

/* ---------------------------- formatting ---------------------------- */

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length))
  );
  const fmt = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i] + 3)).join("").trimEnd();
  return [fmt(headers), ...rows.map(fmt)].join("\n");
}

function age(cluster: Cluster, sinceTick: number): string {
  const t = Math.max(0, cluster.tick - sinceTick);
  if (t < 60) return `${t}s`;
  return `${Math.floor(t / 60)}m${t % 60}s`;
}

function podStatus(p: K8sPod): string {
  if (p.phase === "Running" && !p.ready) return "Running";
  return p.phase;
}

/* ------------------------- argument parsing -------------------------- */

/** Flags that take a value (`-o wide`, `--replicas 3`, `--replicas=3`). */
const VALUE_FLAGS = new Set([
  "-n", "--namespace", "-o", "--output", "-l", "--selector", "-f", "--filename",
  "-p", "--patch", "--replicas", "--tail", "-c", "--container", "--type",
  "--grace-period", "--timeout", "--sort-by",
]);

interface ParsedArgs {
  /** The verb first, then every non-flag word in the order it was typed. */
  args: string[];
  /** Flags by name: `--replicas=3` and `--replicas 3` both give {"--replicas": "3"}. */
  flags: Record<string, string>;
}

/**
 * Real kubectl accepts flags anywhere (`kubectl scale --replicas=3 deploy/web`,
 * `kubectl -n default get pods`). Split the words into positionals and flags
 * so every command below can simply read args[1], args[2], ...
 */
function parseArgs(tokens: string[]): ParsedArgs {
  const args: string[] = [];
  const flags: Record<string, string> = {};
  const verb = tokens.find((t, i) => !t.startsWith("-") && !VALUE_FLAGS.has(tokens[i - 1] ?? ""));
  // For `logs`, -f means --follow and -p means --previous: no value follows.
  const takesValue = (flag: string) =>
    VALUE_FLAGS.has(flag) && !(verb === "logs" && (flag === "-f" || flag === "-p"));
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t.startsWith("-")) {
      args.push(t);
      continue;
    }
    const eq = t.indexOf("=");
    if (eq > 0) {
      flags[t.slice(0, eq)] = t.slice(eq + 1);
    } else if (takesValue(t)) {
      // A patch body is JSON and may contain spaces: it runs to the end of the line.
      if (t === "-p" || t === "--patch") {
        flags[t] = tokens.slice(i + 1).join(" ");
        break;
      }
      flags[t] = tokens[i + 1] ?? "";
      i++;
    } else {
      flags[t] = "true";
    }
  }
  return { args, flags };
}

/* ---------------------------- resolvers ----------------------------- */

const POD_ALIASES = ["pod", "pods", "po"];
const NODE_ALIASES = ["node", "nodes", "no"];
const DEPLOY_ALIASES = ["deployment", "deployments", "deploy"];
const SVC_ALIASES = ["service", "services", "svc"];
const CM_ALIASES = ["configmap", "configmaps", "cm"];
const SECRET_ALIASES = ["secret", "secrets"];
const EP_ALIASES = ["endpoints", "ep"];

/** Splits "deployment/web" or ("deployment", "web") into kind + name. */
function kindAndName(args: string[]): { kind?: string; name?: string; rest: string[] } {
  if (args.length === 0) return { rest: [] };
  if (args[0].includes("/")) {
    const [kind, name] = args[0].split("/");
    return { kind, name, rest: args.slice(1) };
  }
  return { kind: args[0], name: args[1], rest: args.slice(2) };
}

/* ------------------------------ get --------------------------------- */

function getNodes(c: Cluster): CmdResult {
  return out(
    table(
      // Requests, not live usage: the scheduler only ever looks at requests.
      ["NAME", "STATUS", "ROLES", "CPU-REQUESTS", "MEM-REQUESTS"],
      c.nodes.map((n) => {
        const u = nodeUsage(c, n.name);
        const status = n.status === "Ready"
          ? n.cordoned ? "Ready,SchedulingDisabled" : "Ready"
          : n.cordoned ? "NotReady,SchedulingDisabled" : "NotReady";
        return [
          n.name,
          status,
          n.roles,
          `${u.cpu}/${n.cpuCapacity}m`,
          `${u.mem}/${n.memCapacity}Mi`,
        ];
      })
    )
  );
}

interface PodListOptions {
  wide?: boolean;
  showLabels?: boolean;
  /** `-l app=web` — only the `app` label exists in Kubetopia. */
  selector?: string;
}

function getPods(c: Cluster, opts: PodListOptions = {}): CmdResult {
  let pods = c.pods;
  if (opts.selector !== undefined) {
    const m = opts.selector.match(/^app=+(.+)$/);
    if (!m) return err(`error: unsupported selector "${opts.selector}" — Kubetopia pods only carry the "app" label (e.g. -l app=web)`);
    pods = pods.filter((p) => p.labels.app === m[1]);
  }
  if (pods.length === 0) return out("No resources found in default namespace.");
  const headers = ["NAME", "READY", "STATUS", "RESTARTS", "AGE"];
  if (opts.wide) headers.push("IP", "NODE", "IMAGE");
  if (opts.showLabels) headers.push("LABELS");
  const rows = pods
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      const row = [
        p.name,
        `${p.ready ? 1 : 0}/1`,
        podStatus(p),
        String(p.restarts),
        age(c, p.createdAtTick),
      ];
      if (opts.wide) row.push(podIP(c, p), p.nodeName ?? "<none>", p.image);
      if (opts.showLabels) row.push(`app=${p.labels.app ?? "<none>"}`);
      return row;
    });
  return out(table(headers, rows));
}

function getDeployments(c: Cluster): CmdResult {
  if (c.deployments.length === 0) return out("No resources found in default namespace.");
  return out(
    table(
      ["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "IMAGE"],
      c.deployments.map((d) => [
        d.name,
        `${readyPodsOf(c, d.name).length}/${d.replicas}`,
        String(livePodsOf(c, d.name).filter((p) => p.image === d.image).length),
        String(readyPodsOf(c, d.name).length),
        d.image,
      ])
    )
  );
}

function getServices(c: Cluster): CmdResult {
  if (c.services.length === 0) return out("No resources found in default namespace.");
  return out(
    table(
      ["NAME", "TYPE", "PORT", "SELECTOR", "ENDPOINTS"],
      c.services.map((s) => {
        const ready = c.pods.filter(
          (p) => p.labels.app === s.selectorApp && p.ready
        ).length;
        return [
          s.name,
          "ClusterIP",
          `${s.port}/TCP`,
          `app=${s.selectorApp}`,
          ready === 0 ? "<none>" : `${ready} ready`,
        ];
      })
    )
  );
}

/** Ready pods selected by a service, as `ip:targetPort` (what `get endpoints` prints). */
function endpointsOf(c: Cluster, s: K8sService): string[] {
  return c.pods
    .filter((p) => p.labels.app === s.selectorApp && p.ready)
    .map((p) => `${podIP(c, p)}:${s.targetPort ?? 8080}`);
}

function getEndpoints(c: Cluster): CmdResult {
  if (c.services.length === 0) return out("No resources found in default namespace.");
  return out(
    table(
      ["NAME", "ENDPOINTS"],
      c.services.map((s) => {
        const eps = endpointsOf(c, s);
        return [s.name, eps.length > 0 ? eps.join(",") : "<none>"];
      })
    )
  );
}

function describeService(c: Cluster, name: string): CmdResult {
  const s = c.services.find((x) => x.name === name);
  if (!s) return err(`Error from server (NotFound): services "${name}" not found`);
  const eps = endpointsOf(c, s);
  const targetPort = s.targetPort ?? 8080;
  const lines = [
    `Name:         ${s.name}`,
    `Namespace:    default`,
    `Selector:     app=${s.selectorApp}`,
    `Type:         ClusterIP`,
    `Port:         ${s.port}/TCP`,
    `TargetPort:   ${targetPort}/TCP`,
    `Endpoints:    ${eps.length > 0 ? eps.join(",") : "<none>"}`,
  ];
  const labelled = c.pods.filter((p) => p.labels.app === s.selectorApp && p.phase !== "Terminating");
  const backend = c.deployments.find((d) => d.app === s.selectorApp);
  if (labelled.length === 0) {
    lines.push("", `Warning: no pod carries the label app=${s.selectorApp}. Compare this selector with \`kubectl get pods --show-labels\`.`);
  } else if (eps.length === 0) {
    lines.push("", `Warning: ${labelled.length} pod(s) match the selector but none is Ready — only Ready pods become endpoints.`);
  } else if (backend && listenPortOf(c, backend) !== targetPort) {
    lines.push("", `Warning: targetPort ${targetPort} is not the port the app listens on (${listenPortOf(c, backend)}) — connections will be refused.`);
  }
  return out(lines.join("\n"));
}

/** `kubectl get <kind> <name> -o yaml` for the kinds the YAML editor understands. */
function getYaml(c: Cluster, kind: string, name: string | undefined): CmdResult {
  if (!name) return err(`error: name a single resource for -o yaml, e.g. "kubectl get ${kind} <name> -o yaml"`);
  if (DEPLOY_ALIASES.includes(kind)) {
    const d = c.deployments.find((x) => x.name === name);
    return d ? out(deploymentToYaml(d)) : err(`Error from server (NotFound): deployments "${name}" not found`);
  }
  if (SVC_ALIASES.includes(kind)) {
    const svc = c.services.find((x) => x.name === name);
    return svc ? out(serviceToYaml(svc)) : err(`Error from server (NotFound): services "${name}" not found`);
  }
  if (CM_ALIASES.includes(kind)) {
    const cm = c.configMaps.find((x) => x.name === name);
    return cm ? out(configMapToYaml(cm)) : err(`Error from server (NotFound): configmaps "${name}" not found`);
  }
  if (SECRET_ALIASES.includes(kind)) {
    const sec = c.secrets.find((x) => x.name === name);
    // Authentic view: values base64-ENCODED (not encrypted) under data:.
    return sec ? out(secretToYaml(sec, true)) : err(`Error from server (NotFound): secrets "${name}" not found`);
  }
  return err(`error: -o yaml is only simulated for deployments, services, configmaps and secrets — try "kubectl describe ${kind} ${name}"`);
}

function getConfigMaps(c: Cluster): CmdResult {
  if (c.configMaps.length === 0) return out("No resources found in default namespace.");
  return out(
    table(
      ["NAME", "DATA", "KEYS"],
      c.configMaps.map((cm) => [
        cm.name,
        String(Object.keys(cm.data).length),
        Object.keys(cm.data).join(", ") || "<none>",
      ])
    )
  );
}

function describeConfigMap(c: Cluster, name: string): CmdResult {
  const cm = c.configMaps.find((x) => x.name === name);
  if (!cm) return err(`Error from server (NotFound): configmaps "${name}" not found`);
  const lines = [`Name:         ${cm.name}`, ``, `Data`, `====`];
  for (const [k, v] of Object.entries(cm.data)) lines.push(`${k}:`, `----`, v, ``);
  if (Object.keys(cm.data).length === 0) lines.push("<empty>");
  return out(lines.join("\n"));
}

function getSecrets(c: Cluster): CmdResult {
  if (c.secrets.length === 0) return out("No resources found in default namespace.");
  return out(
    table(
      ["NAME", "TYPE", "DATA", "KEYS"],
      c.secrets.map((s) => [
        s.name,
        "Opaque",
        String(Object.keys(s.data).length),
        Object.keys(s.data).join(", ") || "<none>",
      ])
    )
  );
}

function describeSecret(c: Cluster, name: string): CmdResult {
  const s = c.secrets.find((x) => x.name === name);
  if (!s) return err(`Error from server (NotFound): secrets "${name}" not found`);
  const lines = [`Name:         ${s.name}`, `Type:         Opaque`, ``, `Data`, `====`];
  // Like the real kubectl, values are never printed — only sizes.
  for (const [k, v] of Object.entries(s.data)) lines.push(`${k}:  ${v.length} bytes`);
  if (Object.keys(s.data).length === 0) lines.push("<empty>");
  return out(lines.join("\n"));
}

function getEvents(c: Cluster): CmdResult {
  const recent = c.events.slice(-15);
  if (recent.length === 0) return out("No events found.");
  return out(
    table(
      ["AGE", "TYPE", "OBJECT", "MESSAGE"],
      recent.map((e) => [age(c, e.tick), e.type, e.object, e.message])
    )
  );
}

/* ---------------------------- describe ------------------------------ */

function describePod(c: Cluster, name: string): CmdResult {
  const p = c.pods.find((x) => x.name === name);
  if (!p) return err(`Error from server (NotFound): pods "${name}" not found`);
  const image = c.registry[p.image];
  const owner = c.deployments.find((d) => d.name === p.owner);
  const lines = [
    `Name:         ${p.name}`,
    `Node:         ${p.nodeName ?? "<none>"}`,
    `IP:           ${podIP(c, p)}`,
    `Status:       ${podStatus(p)}`,
    `Ready:        ${p.ready}`,
    `Restarts:     ${p.restarts}`,
    `Container:    ${owner ? containerNameOf(owner) : "<none>"}`,
    `Image:        ${p.image}`,
    `Requests:     cpu=${p.cpu}m, memory=${p.memory}Mi`,
    `Labels:       app=${p.labels.app ?? "<none>"}`,
    `Controlled By: Deployment/${p.owner ?? "<none>"}`,
  ];
  if (owner?.probePort !== undefined) {
    lines.push(`Readiness:    http-get http://:${owner.probePort}/healthz`);
  }
  if (owner?.configRef || owner?.secretRef) {
    lines.push(`Environment:`);
    if (owner.configRef) {
      lines.push(
        `  ${envVarName(owner.configRef.key)}:  <set to the key '${owner.configRef.key}' of config map '${owner.configRef.name}'>  Optional: ${!!owner.configRef.optional}`
      );
    }
    if (owner.secretRef) {
      lines.push(
        `  ${envVarName(owner.secretRef.key)}:  <set to the key '${owner.secretRef.key}' in secret '${owner.secretRef.name}'>  Optional: ${!!owner.secretRef.optional}`
      );
    }
  }
  lines.push(``, `Conditions:`, `  Ready: ${p.ready}`, ``, `Recent events for this pod:`);
  const events = c.events.filter((e) => e.object === `pod/${p.name}`).slice(-6);
  if (events.length === 0) lines.push("  <none>");
  for (const e of events) lines.push(`  ${e.type}  ${e.message}`);
  if (p.phase === "ImagePullBackOff") {
    lines.push("", `Warning: image "${p.image}" cannot be pulled. Check the image name/tag.`);
  }
  if (p.phase === "CrashLoopBackOff" || (image?.crashes && p.phase === "Running")) {
    lines.push("", "Warning: container keeps crashing shortly after start. Check `kubectl logs`.");
  }
  if (p.phase === "Pending") {
    lines.push("", `Warning  FailedScheduling  ${schedulingFailureMessage(c, p)}`);
  }
  const issue = podStartupIssue(c, p.owner);
  const blocked = configErrorMessage(issue);
  if (p.phase === "CreateContainerConfigError" && blocked) {
    lines.push(
      "",
      `Warning  Failed  Error: ${blocked}`,
      "The container cannot be created until that reference resolves: fix the name/key in the Deployment's env, or create the missing ConfigMap/Secret/key."
    );
  }
  if (issue.probeBroken && p.phase === "Running") {
    lines.push(
      "",
      `Warning  Unhealthy  Readiness probe failed: Get "http://${podIP(c, p)}:${owner?.probePort}/healthz": dial tcp ${podIP(c, p)}:${owner?.probePort}: connect: connection refused`,
      "Nothing answers on the probed port. Check which port the app really listens on (its logs say) and point readinessProbe.httpGet.port at it."
    );
  }
  return out(lines.join("\n"));
}

function describeNode(c: Cluster, name: string): CmdResult {
  const n = c.nodes.find((x) => x.name === name);
  if (!n) return err(`Error from server (NotFound): nodes "${name}" not found`);
  const u = nodeUsage(c, n.name);
  const pods = c.pods.filter((p) => p.nodeName === n.name);
  return out(
    [
      `Name:               ${n.name}`,
      `Roles:              ${n.roles}`,
      `Status:             ${n.status}`,
      `Taints:             ${
        [
          n.roles === "control-plane" ? "node-role.kubernetes.io/control-plane:NoSchedule" : "",
          n.status !== "Ready" ? "node.kubernetes.io/unreachable:NoExecute" : "",
          n.cordoned ? "node.kubernetes.io/unschedulable:NoSchedule" : "",
        ]
          .filter(Boolean)
          .join(", ") || "<none>"
      }`,
      `Unschedulable:      ${n.cordoned}`,
      `Allocatable:        cpu=${n.cpuCapacity}m, memory=${n.memCapacity}Mi`,
      `Allocated requests: cpu=${u.cpu}m, memory=${u.mem}Mi`,
      ``,
      `Pods on this node (${pods.length}):`,
      ...pods.map((p) => `  ${p.name}  ${podStatus(p)}`),
    ].join("\n")
  );
}

function describeDeployment(c: Cluster, name: string): CmdResult {
  const d = c.deployments.find((x) => x.name === name);
  if (!d) return err(`Error from server (NotFound): deployments "${name}" not found`);
  return out(
    [
      `Name:                 ${d.name}`,
      `Replicas:             ${d.replicas} desired | ${livePodsOf(c, d.name).length} total | ${readyPodsOf(c, d.name).length} ready`,
      `StrategyType:         Recreate`,
      `Container:            ${containerNameOf(d)}`,
      `Image:                ${d.image}`,
      d.previousImage ? `Previous image:       ${d.previousImage}` : ``,
      `Pod requests:         cpu=${d.cpuPerPod}m, memory=${d.memPerPod}Mi`,
      `Selector/labels:      app=${d.app}`,
    ]
      .filter(Boolean)
      .join("\n")
  );
}

/* ------------------------------ main --------------------------------- */

export function runKubectl(
  cluster: Cluster,
  raw: string,
  files: Record<string, string> = {}
): CmdResult {
  const tokens = raw.trim().split(/\s+/);
  if (tokens[0] !== "kubectl" && tokens[0] !== "k") {
    return err(`command not found: ${tokens[0]}. This console speaks kubectl (try "help").`);
  }
  const { args, flags } = parseArgs(tokens.slice(1));
  const flag = (...names: string[]) => names.map((n) => flags[n]).find((v) => v !== undefined);
  const verb = args[0];

  // Kubetopia has a single namespace; be honest about anything else.
  const ns = flag("-n", "--namespace");
  if (ns !== undefined && ns !== "default") {
    return verb === "get"
      ? out(`No resources found in ${ns} namespace.`)
      : err(`Error from server (NotFound): namespaces "${ns}" not found (Kubetopia only simulates "default")`);
  }

  switch (verb) {
    case "get": {
      const output = flag("-o", "--output");
      const { kind, name } = kindAndName(args.slice(1));
      if (!kind) return err('error: you must specify the type of resource to get, e.g. "kubectl get pods"');
      if (output === "yaml") return getYaml(cluster, kind, name);
      // `kubectl get <kind> <name>` narrows the list to one object (or NotFound).
      const named = <T extends { name: string }>(
        items: T[],
        plural: string,
        render: (items: T[]) => CmdResult
      ): CmdResult => {
        if (!name) return render(items);
        const hit = items.filter((x) => x.name === name);
        return hit.length > 0 ? render(hit) : err(`Error from server (NotFound): ${plural} "${name}" not found`);
      };
      const podOpts: PodListOptions = {
        wide: output === "wide",
        showLabels: flags["--show-labels"] !== undefined,
        selector: flag("-l", "--selector"),
      };
      if (NODE_ALIASES.includes(kind)) return named(cluster.nodes, "nodes", (nodes) => getNodes({ ...cluster, nodes }));
      if (POD_ALIASES.includes(kind)) return named(cluster.pods, "pods", (pods) => getPods({ ...cluster, pods }, podOpts));
      if (DEPLOY_ALIASES.includes(kind)) {
        return named(cluster.deployments, "deployments", (deployments) => getDeployments({ ...cluster, deployments }));
      }
      if (SVC_ALIASES.includes(kind)) return named(cluster.services, "services", (services) => getServices({ ...cluster, services }));
      if (EP_ALIASES.includes(kind)) return named(cluster.services, "endpoints", (services) => getEndpoints({ ...cluster, services }));
      if (CM_ALIASES.includes(kind)) return named(cluster.configMaps, "configmaps", (configMaps) => getConfigMaps({ ...cluster, configMaps }));
      if (SECRET_ALIASES.includes(kind)) return named(cluster.secrets, "secrets", (secrets) => getSecrets({ ...cluster, secrets }));
      if (kind === "events" || kind === "ev") return getEvents(cluster);
      if (kind === "all") {
        return out(
          [getDeployments(cluster).output, "", getPods(cluster).output, "", getServices(cluster).output].join("\n")
        );
      }
      return err(`error: the server doesn't have a resource type "${kind}"`);
    }

    case "describe": {
      const { kind, name } = kindAndName(args.slice(1));
      if (!kind || !name) return err("error: describe needs a resource and a name, e.g. kubectl describe pod web-abc12");
      if (POD_ALIASES.includes(kind)) return describePod(cluster, name);
      if (NODE_ALIASES.includes(kind)) return describeNode(cluster, name);
      if (DEPLOY_ALIASES.includes(kind)) return describeDeployment(cluster, name);
      if (SVC_ALIASES.includes(kind)) return describeService(cluster, name);
      if (CM_ALIASES.includes(kind)) return describeConfigMap(cluster, name);
      if (SECRET_ALIASES.includes(kind)) return describeSecret(cluster, name);
      return err(`error: the server doesn't have a resource type "${kind}"`);
    }

    case "apply": {
      const filename = flag("-f", "--filename");
      if (!filename) return err("usage: kubectl apply -f <file.yaml>");
      const content = files[filename];
      if (content === undefined) {
        const available = Object.keys(files);
        return err(
          available.length > 0
            ? `error: the path "${filename}" does not exist. Files available: ${available.join(", ")}`
            : `error: the path "${filename}" does not exist (this mission has no blueprint files)`
        );
      }
      return {
        ok: true,
        output: `Opening ${filename} for review — fix anything that looks wrong, then press Apply.`,
        editor: { title: `apply -f ${filename}`, content, filename },
      };
    }

    case "edit": {
      const { kind, name } = kindAndName(args.slice(1));
      if (!kind || !name) return err("usage: kubectl edit deployment|service|configmap <name>");
      if (DEPLOY_ALIASES.includes(kind)) {
        const d = cluster.deployments.find((x) => x.name === name);
        if (!d) return err(`Error from server (NotFound): deployments "${name}" not found`);
        return {
          ok: true,
          output: `Opening deployment/${name} in the editor...`,
          editor: { title: `edit deployment/${name}`, content: deploymentToYaml(d), resource: { kind: "Deployment", name } },
        };
      }
      if (SVC_ALIASES.includes(kind)) {
        const s = cluster.services.find((x) => x.name === name);
        if (!s) return err(`Error from server (NotFound): services "${name}" not found`);
        return {
          ok: true,
          output: `Opening service/${name} in the editor...`,
          editor: { title: `edit service/${name}`, content: serviceToYaml(s), resource: { kind: "Service", name } },
        };
      }
      if (CM_ALIASES.includes(kind)) {
        const cm = cluster.configMaps.find((x) => x.name === name);
        if (!cm) return err(`Error from server (NotFound): configmaps "${name}" not found`);
        return {
          ok: true,
          output: `Opening configmap/${name} in the editor...`,
          editor: { title: `edit configmap/${name}`, content: configMapToYaml(cm), resource: { kind: "ConfigMap", name } },
        };
      }
      if (SECRET_ALIASES.includes(kind)) {
        const sec = cluster.secrets.find((x) => x.name === name);
        if (!sec) return err(`Error from server (NotFound): secrets "${name}" not found`);
        return {
          ok: true,
          output: `Opening secret/${name} in the editor...`,
          editor: { title: `edit secret/${name}`, content: secretToYaml(sec), resource: { kind: "Secret", name } },
        };
      }
      return err(`error: editing "${kind}" is not supported (deployment, service, configmap, secret)`);
    }

    case "logs": {
      let name = args[1];
      if (!name) return err("error: logs needs a pod name, e.g. kubectl logs web-abc12 (or kubectl logs deployment/web)");
      // `kubectl logs deployment/web` picks one pod of the deployment.
      if (name.includes("/")) {
        const [k, owner] = name.split("/");
        if (!DEPLOY_ALIASES.includes(k)) return err("error: logs takes a pod name or deployment/<name>");
        const first = livePodsOf(cluster, owner)[0];
        if (!first) return err(`error: no pods found for deployment "${owner}"`);
        name = first.name;
      }
      const p = cluster.pods.find((x) => x.name === name);
      if (!p) return err(`Error from server (NotFound): pods "${name}" not found`);
      const image = cluster.registry[p.image];
      if (
        p.phase === "Pending" ||
        p.phase === "ContainerCreating" ||
        p.phase === "ImagePullBackOff" ||
        p.phase === "CreateContainerConfigError"
      ) {
        // No container ever ran, so there is nothing to print — describe the pod instead.
        return err(
          `Error from server (BadRequest): container in pod "${name}" is waiting to start: ${p.phase} — no logs yet, try "kubectl describe pod ${name}"`
        );
      }
      const issue = podStartupIssue(cluster, p.owner);
      if (issue.configMissing?.optional) {
        return out(
          [
            `${p.image} starting...`,
            `reading configuration from ConfigMap "${issue.configMissing.name}"...`,
            `FATAL: required config key "${issue.configMissing.key}" not found`,
            `process exited with code 1`,
          ].join("\n")
        );
      }
      if (issue.secretMissing?.optional) {
        return out(
          [
            `${p.image} starting...`,
            `loading credentials from Secret "${issue.secretMissing.name}"...`,
            `FATAL: required secret key "${issue.secretMissing.key}" not found`,
            `process exited with code 1`,
          ].join("\n")
        );
      }
      const lines = image?.logs ?? [`${p.image}: listening on port 8080`, "ready to serve requests"];
      return out(lines.join("\n"));
    }

    case "delete": {
      const { kind, name, rest } = kindAndName(args.slice(1));
      if (!kind || !name) return err("error: delete needs a resource and a name");
      if (POD_ALIASES.includes(kind)) {
        const lines: string[] = [];
        for (const podName of [name, ...rest]) {
          const p = cluster.pods.find((x) => x.name === podName);
          if (!p) return err([...lines, `Error from server (NotFound): pods "${podName}" not found`].join("\n"));
          terminatePod(cluster, p);
          lines.push(`pod "${podName}" deleted`);
        }
        return out(lines.join("\n"));
      }
      return err(`deleting "${kind}" is not allowed in this mission`);
    }

    case "scale": {
      const { kind, name } = kindAndName(args.slice(1));
      const repRaw = flag("--replicas");
      if (!kind || !name || repRaw === undefined || !DEPLOY_ALIASES.includes(kind)) {
        return err("usage: kubectl scale deployment/<name> --replicas=<n>");
      }
      const n = /^\d+$/.test(repRaw) ? parseInt(repRaw, 10) : NaN;
      if (isNaN(n) || n < 0 || n > 20) return err("error: --replicas must be a number between 0 and 20");
      const d = cluster.deployments.find((x) => x.name === name);
      if (!d) return err(`Error from server (NotFound): deployments "${name}" not found`);
      d.replicas = n;
      addEvent(cluster, "Normal", `deployment/${d.name}`, `Scaled to ${n} replicas`);
      return out(`deployment.apps/${name} scaled`);
    }

    case "set": {
      // kubectl set image deployment/web web=bakery-web:1.4
      if (args[1] !== "image") return err("usage: kubectl set image deployment/<name> <container>=<image>");
      const { kind, name, rest } = kindAndName(args.slice(2));
      const assignment = rest.find((a) => a.includes("="));
      if (!kind || !name || !DEPLOY_ALIASES.includes(kind) || !assignment) {
        return err("usage: kubectl set image deployment/<name> <container>=<image>");
      }
      const d = cluster.deployments.find((x) => x.name === name);
      if (!d) return err(`Error from server (NotFound): deployments "${name}" not found`);
      const [container, newImage] = assignment.split("=");
      if (container !== "*" && container !== containerNameOf(d)) {
        return err(
          `error: unable to find container named "${container}" — deployment/${name} has one container, named "${containerNameOf(d)}" (see kubectl describe deployment ${name})`
        );
      }
      if (!newImage) return err("usage: kubectl set image deployment/<name> <container>=<image>");
      if (newImage === d.image) return out(`deployment.apps/${name} image unchanged`);
      d.previousImage = d.image;
      d.image = newImage;
      rolloutDeployment(cluster, d);
      return out(`deployment.apps/${name} image updated`);
    }

    case "rollout": {
      const sub = args[1];
      const { kind, name } = kindAndName(args.slice(2));
      if (!kind || !name || !DEPLOY_ALIASES.includes(kind)) {
        return err("usage: kubectl rollout undo|restart|status|history deployment/<name>");
      }
      const d = cluster.deployments.find((x) => x.name === name);
      if (!d) return err(`Error from server (NotFound): deployments "${name}" not found`);
      if (sub === "history") {
        // Kubetopia remembers one previous revision — enough for `rollout undo`.
        const rows = d.previousImage ? [["1", d.previousImage], ["2", d.image]] : [["1", d.image]];
        return out([`deployment.apps/${name}`, table(["REVISION", "IMAGE"], rows)].join("\n"));
      }
      if (sub === "undo") {
        if (!d.previousImage) return err(`error: no rollout history found for deployment "${name}"`);
        const prev = d.previousImage;
        d.previousImage = d.image;
        d.image = prev;
        rolloutDeployment(cluster, d);
        return out(`deployment.apps/${name} rolled back to ${prev}`);
      }
      if (sub === "restart") {
        rolloutDeployment(cluster, d);
        return out(`deployment.apps/${name} restarted`);
      }
      if (sub === "status") {
        const ready = readyPodsOf(cluster, d.name).length;
        return out(
          ready >= d.replicas
            ? `deployment "${name}" successfully rolled out`
            : `Waiting for deployment "${name}" rollout: ${ready} of ${d.replicas} updated replicas are available...`
        );
      }
      return err("usage: kubectl rollout undo|restart|status|history deployment/<name>");
    }

    case "cordon":
    case "uncordon": {
      const name = args[1];
      if (!name) return err(`error: ${verb} needs a node name, e.g. kubectl ${verb} worker-1`);
      const node = cluster.nodes.find((n) => n.name === name);
      if (!node) return err(`Error from server (NotFound): nodes "${name}" not found`);
      node.cordoned = verb === "cordon";
      addEvent(cluster, "Normal", `node/${name}`, verb === "cordon" ? "Node marked unschedulable" : "Node marked schedulable");
      return out(`node/${name} ${verb === "cordon" ? "cordoned" : "uncordoned"}`);
    }

    case "drain": {
      const name = args[1];
      if (!name) return err("error: drain needs a node name, e.g. kubectl drain worker-1 --ignore-daemonsets");
      const node = cluster.nodes.find((n) => n.name === name);
      if (!node) return err(`Error from server (NotFound): nodes "${name}" not found`);
      node.cordoned = true;
      const victims = cluster.pods.filter((p) => p.nodeName === name && p.phase !== "Terminating");
      for (const p of victims) terminatePod(cluster, p);
      addEvent(cluster, "Normal", `node/${name}`, `Drained: evicted ${victims.length} pod(s)`);
      return out([`node/${name} cordoned`, ...victims.map((p) => `evicting pod default/${p.name}`), `node/${name} drained`].join("\n"));
    }

    case "patch": {
      // Simplified: kubectl patch service <name> -p '{"spec":{"selector":{"app":"ticket"}}}'
      const { kind, name } = kindAndName(args.slice(1));
      if (!kind || !name || !SVC_ALIASES.includes(kind)) {
        return err(`usage: kubectl patch service <name> -p '{"spec":{"selector":{"app":"<value>"}}}'`);
      }
      const svc = cluster.services.find((s) => s.name === name);
      if (!svc) return err(`Error from server (NotFound): services "${name}" not found`);
      const match = raw.match(/app["'\s:]+([A-Za-z0-9-]+)/);
      if (!match) return err(`error: could not find an "app" selector in the patch. Example:\nkubectl patch service ${name} -p '{"spec":{"selector":{"app":"my-app"}}}'`);
      svc.selectorApp = match[1];
      addEvent(cluster, "Normal", `service/${name}`, `Selector changed to app=${match[1]}`);
      return out(`service/${name} patched`);
    }

    case "top": {
      // `top` reports LIVE usage from metrics-server, which Kubetopia does not
      // simulate. Capacity planning here is about requests, so say so.
      return err(
        "error: Metrics API not available (metrics-server is not installed in Kubetopia).\n" +
          "`kubectl top` would show live usage, but the scheduler only looks at REQUESTS:\n" +
          "see the CPU-REQUESTS column of `kubectl get nodes`, or `kubectl describe node <name>`."
      );
    }

    case "version":
      return out("Client Version: v1.31.0-kubequest\nServer Version: v1.31.0-kubequest");

    default:
      return err(`error: unknown command "${verb ?? ""}". Type "help" for the commands this mission supports.`);
  }
}

export const HELP_TEXT = `Kubetopia console — supported commands
  kubectl get nodes|pods|deployments|services|endpoints|configmaps|secrets|events|all
      (aliases: no, po, deploy, svc, ep, cm)   add a name to show just one
  kubectl get pods -o wide | --show-labels | -l app=<value>
  kubectl get deployment|service|configmap|secret <name> -o yaml
  kubectl describe pod|node|deployment|service|configmap|secret <name>
  kubectl logs <pod>   (or: kubectl logs deployment/<name>)
  kubectl delete pod <name>
  kubectl scale deployment/<name> --replicas=<n>
  kubectl set image deployment/<name> <container>=<image>
  kubectl rollout undo|restart|status|history deployment/<name>
  kubectl cordon|uncordon|drain <node>
  kubectl patch service <name> -p '{"spec":{"selector":{"app":"<value>"}}}'
  kubectl apply -f <file.yaml>   — open a blueprint in the YAML editor & apply
  kubectl edit deployment|service|configmap|secret <name>   — edit live YAML
  ls        — list blueprint files in this mission
  cat <file> — print a blueprint file
  hint      — nudge for the current objective
  clear     — clear the console
  help      — this text
Tip: "k" works as a shortcut for "kubectl". Press Tab to complete names.
Simulator notes: one namespace (default); every Deployment uses the Recreate
strategy (old pods stop before new ones start); node CPU/memory columns show
REQUESTS, which is what the scheduler counts.`;
