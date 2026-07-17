/**
 * A forgiving kubectl-style command interpreter for the simulator.
 * Supports the real-world subset of commands the missions need, with the
 * genuine syntax (aliases like `po`, `deploy`, `svc` included).
 */

import {
  addEvent,
  livePodsOf,
  nodeUsage,
  podStartupIssue,
  readyPodsOf,
  rolloutDeployment,
  terminatePod,
} from "./engine";
import { configMapToYaml, deploymentToYaml, serviceToYaml } from "./manifest";
import type { Cluster, K8sPod } from "./types";

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

/* ---------------------------- resolvers ----------------------------- */

const POD_ALIASES = ["pod", "pods", "po"];
const NODE_ALIASES = ["node", "nodes", "no"];
const DEPLOY_ALIASES = ["deployment", "deployments", "deploy"];
const SVC_ALIASES = ["service", "services", "svc"];
const CM_ALIASES = ["configmap", "configmaps", "cm"];

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
      ["NAME", "STATUS", "ROLES", "CPU-USE", "MEM-USE"],
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

function getPods(c: Cluster, wide: boolean): CmdResult {
  if (c.pods.length === 0) return out("No resources found in default namespace.");
  const headers = ["NAME", "READY", "STATUS", "RESTARTS", "AGE"];
  if (wide) headers.push("NODE", "IMAGE");
  const rows = c.pods
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
      if (wide) row.push(p.nodeName ?? "<none>", p.image);
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
  const lines = [
    `Name:         ${p.name}`,
    `Node:         ${p.nodeName ?? "<none>"}`,
    `Status:       ${podStatus(p)}`,
    `Ready:        ${p.ready}`,
    `Restarts:     ${p.restarts}`,
    `Image:        ${p.image}`,
    `Requests:     cpu=${p.cpu}m, memory=${p.memory}Mi`,
    `Labels:       app=${p.labels.app ?? "<none>"}`,
    `Controlled By: Deployment/${p.owner ?? "<none>"}`,
    ``,
    `Conditions:`,
    `  Ready: ${p.ready}`,
    ``,
    `Recent events for this pod:`,
  ];
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
    lines.push("", "Warning: pod is unschedulable. Check node capacity and cordons.");
  }
  const issue = podStartupIssue(c, p.owner);
  if (issue.configMissing) {
    lines.push(
      "",
      `Warning: container requires config key "${issue.configMissing.key}" from ConfigMap "${issue.configMissing.name}", which is missing.`,
      `Check \`kubectl describe configmap ${issue.configMissing.name}\`.`
    );
  }
  if (issue.probeBroken && p.phase === "Running") {
    const owner = c.deployments.find((d) => d.name === p.owner);
    lines.push(
      "",
      `Warning: Readiness probe failed: Get "http://pod:${owner?.probePort}/healthz": connection refused.`,
      `The container listens on port ${owner?.containerPort ?? 8080} — compare with the probe port in the deployment spec.`
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
      `Unschedulable:      ${n.cordoned}`,
      `Allocatable:        cpu=${n.cpuCapacity}m, memory=${n.memCapacity}Mi`,
      `Allocated:          cpu=${u.cpu}m, memory=${u.mem}Mi`,
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
  const args = tokens.slice(1).filter((t) => t !== "-n" && t !== "default" && t !== "--namespace");
  const verb = args[0];

  switch (verb) {
    case "get": {
      const wide = args.includes("-o") && args.includes("wide");
      const kind = args[1];
      if (!kind) return err('error: you must specify the type of resource to get, e.g. "kubectl get pods"');
      if (NODE_ALIASES.includes(kind)) return getNodes(cluster);
      if (POD_ALIASES.includes(kind)) return getPods(cluster, wide);
      if (DEPLOY_ALIASES.includes(kind)) return getDeployments(cluster);
      if (SVC_ALIASES.includes(kind)) return getServices(cluster);
      if (CM_ALIASES.includes(kind)) return getConfigMaps(cluster);
      if (kind === "events" || kind === "ev") return getEvents(cluster);
      if (kind === "all") {
        return out(
          [getDeployments(cluster).output, "", getPods(cluster, false).output, "", getServices(cluster).output].join("\n")
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
      if (CM_ALIASES.includes(kind)) return describeConfigMap(cluster, name);
      return err(`error: the server doesn't have a resource type "${kind}"`);
    }

    case "apply": {
      const fIdx = args.indexOf("-f");
      const filename = fIdx >= 0 ? args[fIdx + 1] : undefined;
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
      return err(`error: editing "${kind}" is not supported (deployment, service, configmap)`);
    }

    case "logs": {
      const name = args[1];
      if (!name) return err("error: logs needs a pod name");
      const p = cluster.pods.find((x) => x.name === name);
      if (!p) return err(`Error from server (NotFound): pods "${name}" not found`);
      const image = cluster.registry[p.image];
      if (p.phase === "Pending" || p.phase === "ContainerCreating" || p.phase === "ImagePullBackOff") {
        return err(`Error from server (BadRequest): container in pod "${name}" is waiting to start`);
      }
      const issue = podStartupIssue(cluster, p.owner);
      if (issue.configMissing) {
        return out(
          [
            `${p.image} starting...`,
            `reading configuration from ConfigMap "${issue.configMissing.name}"...`,
            `FATAL: required config key "${issue.configMissing.key}" not found`,
            `process exited with code 1`,
          ].join("\n")
        );
      }
      const lines = image?.logs ?? [`${p.image}: listening on port 8080`, "ready to serve requests"];
      return out(lines.join("\n"));
    }

    case "delete": {
      const { kind, name } = kindAndName(args.slice(1));
      if (!kind || !name) return err("error: delete needs a resource and a name");
      if (POD_ALIASES.includes(kind)) {
        const p = cluster.pods.find((x) => x.name === name);
        if (!p) return err(`Error from server (NotFound): pods "${name}" not found`);
        terminatePod(cluster, p);
        return out(`pod "${name}" deleted`);
      }
      return err(`deleting "${kind}" is not allowed in this mission`);
    }

    case "scale": {
      const { kind, name } = kindAndName(args.slice(1));
      const repArg = args.find((a) => a.startsWith("--replicas="));
      if (!kind || !name || !repArg || !DEPLOY_ALIASES.includes(kind)) {
        return err("usage: kubectl scale deployment/<name> --replicas=<n>");
      }
      const n = parseInt(repArg.split("=")[1], 10);
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
      const newImage = assignment.split("=")[1];
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
        return err("usage: kubectl rollout undo|restart|status deployment/<name>");
      }
      const d = cluster.deployments.find((x) => x.name === name);
      if (!d) return err(`Error from server (NotFound): deployments "${name}" not found`);
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
      return err("usage: kubectl rollout undo|restart|status deployment/<name>");
    }

    case "cordon":
    case "uncordon": {
      const name = args[1];
      const node = cluster.nodes.find((n) => n.name === name);
      if (!node) return err(`Error from server (NotFound): nodes "${name}" not found`);
      node.cordoned = verb === "cordon";
      addEvent(cluster, "Normal", `node/${name}`, verb === "cordon" ? "Node marked unschedulable" : "Node marked schedulable");
      return out(`node/${name} ${verb === "cordon" ? "cordoned" : "uncordoned"}`);
    }

    case "drain": {
      const name = args.find((a, i) => i > 0 && !a.startsWith("--"));
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
      if (args[1] && NODE_ALIASES.includes(args[1])) return getNodes(cluster);
      return err("usage: kubectl top nodes");
    }

    case "version":
      return out("Client Version: v1.31.0-kubequest\nServer Version: v1.31.0-kubequest");

    default:
      return err(`error: unknown command "${verb ?? ""}". Type "help" for the commands this mission supports.`);
  }
}

export const HELP_TEXT = `Kubetopia console — supported commands
  kubectl get nodes|pods|deployments|services|configmaps|events|all
      (aliases: no, po, deploy, svc, cm)
  kubectl get pods -o wide
  kubectl describe pod|node|deployment|configmap <name>
  kubectl logs <pod>
  kubectl delete pod <name>
  kubectl scale deployment/<name> --replicas=<n>
  kubectl set image deployment/<name> <container>=<image>
  kubectl rollout undo|restart|status deployment/<name>
  kubectl cordon|uncordon|drain <node>
  kubectl patch service <name> -p '{"spec":{"selector":{"app":"<value>"}}}'
  kubectl apply -f <file.yaml>   — open a blueprint in the YAML editor & apply
  kubectl edit deployment|service|configmap <name>   — edit live YAML
  ls        — list blueprint files in this mission
  cat <file> — print a blueprint file
  hint      — nudge for the current objective
  clear     — clear the console
  help      — this text
Tip: "k" works as a shortcut for "kubectl".`;
