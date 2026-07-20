/**
 * Mission completability suite — run with `npm test`.
 *
 * Plays every mission headlessly against the real engine, kubectl parser and
 * objective checks, mirroring gameStore.stepTick (engine tick → scripted
 * events → sequential objective evaluation). Two timing profiles per mission:
 *
 *  - HAPPY: the player acts as soon as each incident lands.
 *  - SLOW:  every scripted event fires BEFORE the player acts. This is the
 *    timing class that has produced hard-stuck states twice — Blackout at
 *    Midnight (worker-2 auto-recovery invalidated the detect objective) and
 *    The Cursed Deploy (the analytics land-grab starved a late rollback).
 *
 * Several commands intentionally use the advertised `k` alias — objective
 * regexes must match it via ranCommand's normalisation.
 *
 * When adding a mission, add BOTH profiles. If an objective can be
 * invalidated by a later scripted event, the slow run is what catches it.
 */
import { tick as engineTick } from "../src/lib/k8s/engine";
import { runKubectl } from "../src/lib/k8s/kubectl";
import { applyYaml } from "../src/lib/k8s/manifest";
import { LEVELS } from "../src/lib/levels";
import type { CommandEntry, LevelDef } from "../src/lib/levels/types";
import type { Cluster } from "../src/lib/k8s/types";

/* ------------------------------ harness ------------------------------ */

interface Sim {
  level: LevelDef;
  cluster: Cluster;
  commands: CommandEntry[];
  completed: string[];
  fired: Set<number>;
  warnings: string[];
}

const byId = (id: number): LevelDef => {
  const l = LEVELS.find((x) => x.id === id);
  if (!l) throw new Error(`no level with id ${id}`);
  return l;
};

function start(level: LevelDef): Sim {
  return { level, cluster: level.buildCluster(), commands: [], completed: [], fired: new Set(), warnings: [] };
}

/** One game tick, mirroring gameStore.stepTick. */
function step(sim: Sim) {
  engineTick(sim.cluster);
  sim.level.events.forEach((ev, i) => {
    if (sim.cluster.tick >= ev.atTick && !sim.fired.has(i)) {
      sim.fired.add(i);
      ev.mutate?.(sim.cluster);
    }
  });
  const ctx = { cluster: sim.cluster, commands: sim.commands, tick: sim.cluster.tick };
  for (const obj of sim.level.objectives) {
    if (sim.completed.includes(obj.id)) continue;
    if (obj.check(ctx)) sim.completed.push(obj.id);
    break; // sequential: only the first incomplete objective is evaluated
  }
}

function run(sim: Sim, raw: string) {
  sim.commands.push({ raw, tick: sim.cluster.tick });
  const res = runKubectl(sim.cluster, raw, sim.level.files ?? {});
  if (!res.ok) sim.warnings.push(`command failed: ${raw} → ${res.output.split("\n")[0]}`);
}

const stepTo = (sim: Sim, tick: number) => { while (sim.cluster.tick < tick) step(sim); };

function podNamed(sim: Sim, prefix: string): string {
  const p = sim.cluster.pods.find((x) => x.name.startsWith(prefix));
  if (!p) sim.warnings.push(`no pod with prefix ${prefix}`);
  return p?.name ?? `${prefix}zzzzz`;
}

let failures = 0;
function finish(sim: Sim, label: string, maxTick: number) {
  stepTo(sim, maxTick);
  const missing = sim.level.objectives.filter((o) => !sim.completed.includes(o.id)).map((o) => o.id);
  for (const w of sim.warnings) console.log(`  ⚠️ ${label}: ${w}`);
  if (missing.length > 0) {
    failures++;
    const pending = sim.cluster.pods.filter((p) => p.phase === "Pending").map((p) => `${p.name}(${p.cpu}m)`);
    console.log(`FAIL: ${label} — stuck on: ${missing.join(", ")}${pending.length ? `  Pending: ${pending.join(", ")}` : ""}`);
  } else {
    console.log(`PASS: ${label}`);
  }
}

function expect(cond: boolean, label: string) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}: ${label}`);
}

/* --------------------- regression: reported bugs --------------------- */

console.log("— Regressions —");

{ // Blackout at Midnight: diagnosis only AFTER worker-2 auto-recovers (tick 110)
  const sim = start(byId(3));
  stepTo(sim, 120);
  expect(sim.cluster.nodes.every((n) => n.status === "Ready"), "[3] worker-2 auto-recovered");
  run(sim, "k get nodes"); // `k` alias must count
  stepTo(sim, 123);
  expect(sim.completed.includes("detect"), "[3] detect completable after auto-recovery, via `k` alias");
}

{ // The Cursed Deploy: rollback AFTER the analytics land-grab (tick 70)
  const sim = start(byId(4));
  stepTo(sim, 80);
  run(sim, `kubectl logs ${podNamed(sim, "payments-")}`);
  stepTo(sim, 82);
  run(sim, "kubectl rollout undo deployment/payments");
  stepTo(sim, 120); // no other action: payments must reclaim its own freed capacity
  expect(sim.completed.includes("rollback"), "[4] late rollback heals without touching analytics");
}

{ // `k` alias across a whole objective (level 1 recon)
  const sim = start(byId(1));
  stepTo(sim, 3);
  run(sim, "k get po");
  run(sim, "k get no");
  stepTo(sim, 6);
  expect(sim.completed.includes("recon"), "[1] recon completes with `k get po` + `k get no`");
}

/* --------------------------- happy paths ----------------------------- */

console.log("\n— Happy path (prompt player) —");

{ // L1
  const sim = start(byId(1));
  stepTo(sim, 2);
  run(sim, "k get pods"); run(sim, "k get nodes");
  stepTo(sim, 4);
  run(sim, `kubectl logs ${podNamed(sim, "bakery-web-")}`);
  stepTo(sim, 6);
  run(sim, "kubectl rollout undo deployment/bakery-web");
  stepTo(sim, 30);
  run(sim, "kubectl scale deployment/bakery-web --replicas=3");
  finish(sim, "[1] First Shift", 60);
}

{ // L2
  const sim = start(byId(2));
  stepTo(sim, 2);
  run(sim, "k get svc");
  stepTo(sim, 4);
  run(sim, `kubectl patch service ticket-svc -p '{"spec":{"selector":{"app":"ticket-shop"}}}'`);
  stepTo(sim, 20);
  run(sim, "kubectl set image deployment/poster-maker poster-maker=poster-maker:2.0");
  stepTo(sim, 40);
  run(sim, "kubectl scale deployment/ticket-shop --replicas=6");
  finish(sim, "[2] Festival Fiasco", 80);
}

{ // L3 — diagnose via events, with the `k` alias
  const sim = start(byId(3));
  stepTo(sim, 27);
  run(sim, "k get events");
  stepTo(sim, 30);
  run(sim, "kubectl drain worker-2 --ignore-daemonsets");
  stepTo(sim, 112);
  run(sim, "kubectl uncordon worker-2");
  finish(sim, "[3] Blackout at Midnight", 130);
}

{ // L4 — prompt rollback, before the spree
  const sim = start(byId(4));
  stepTo(sim, 26);
  run(sim, `kubectl logs ${podNamed(sim, "payments-")}`);
  stepTo(sim, 28);
  run(sim, "kubectl rollout undo deployment/payments");
  stepTo(sim, 75);
  run(sim, "kubectl scale deployment/analytics --replicas=5");
  finish(sim, "[4] Cursed Deploy", 130);
}

{ // L5
  const sim = start(byId(5));
  stepTo(sim, 35);
  run(sim, "kubectl drain worker-3 --ignore-daemonsets");
  stepTo(sim, 52);
  run(sim, "kubectl drain worker-4 --ignore-daemonsets");
  run(sim, "kubectl scale deployment/arcade --replicas=2");
  run(sim, "kubectl scale deployment/hospital --replicas=5");
  stepTo(sim, 152);
  run(sim, "kubectl uncordon worker-3");
  run(sim, "kubectl uncordon worker-4");
  run(sim, "kubectl scale deployment/arcade --replicas=5");
  finish(sim, "[5] Storm Over Kubetopia", 200);
}

{ // L6
  const sim = start(byId(6));
  stepTo(sim, 2);
  applyYaml(sim.cluster, sim.level.files!["library.yaml"]
    .replace('replicas: "two"', "replicas: 2")
    .replace("app: library\n", "app: library-web\n"));
  stepTo(sim, 5);
  run(sim, "kubectl set image deployment/library-web web=library-web:1.2");
  stepTo(sim, 15);
  applyYaml(sim.cluster, sim.level.files!["catalog.yaml"]);
  stepTo(sim, 25);
  run(sim, "kubectl scale deployment/library-web --replicas=3");
  finish(sim, "[6] Grand Library", 60);
}

{ // L7
  const sim = start(byId(7));
  stepTo(sim, 4);
  run(sim, `kubectl logs ${podNamed(sim, "town-banners-")}`);
  run(sim, `kubectl logs ${podNamed(sim, "welcome-hall-")}`);
  stepTo(sim, 6);
  sim.cluster.configMaps.find((c) => c.name === "banner-config")!.data["royal.theme"] = "cumulus-gold";
  stepTo(sim, 30);
  sim.cluster.deployments.find((d) => d.name === "welcome-hall")!.probePort = 8080;
  stepTo(sim, 40);
  run(sim, "kubectl scale deployment/welcome-hall --replicas=4");
  finish(sim, "[7] Cloud Queen's Inspection", 80);
}

{ // CKAD1
  const sim = start(byId(8));
  stepTo(sim, 2);
  run(sim, "k get pods"); run(sim, "k get nodes");
  stepTo(sim, 4);
  applyYaml(sim.cluster, sim.level.files!["admissions.yaml"].replace("app: admissions-desk", "app: admissions"));
  stepTo(sim, 15);
  run(sim, "kubectl scale deployment/admissions-web --replicas=4");
  finish(sim, "[8] Code Blue at Admissions", 40);
}

{ // CKAD2
  const sim = start(byId(9));
  stepTo(sim, 2);
  run(sim, `kubectl logs ${podNamed(sim, "pharmacy-")}`);
  stepTo(sim, 4);
  sim.cluster.configMaps.find((c) => c.name === "formulary-config")!.data["formulary.version"] = "2026-week-29";
  stepTo(sim, 25);
  applyYaml(sim.cluster, sim.level.files!["prescriptions.yaml"]);
  stepTo(sim, 30);
  sim.cluster.deployments.find((d) => d.name === "prescriptions")!.secretRef = { name: "pharmacy-db", key: "password" };
  finish(sim, "[9] Pharmacy Formulary", 70);
}

{ // CKAD3
  const sim = start(byId(10));
  stepTo(sim, 2);
  run(sim, "k get events");
  stepTo(sim, 4);
  sim.cluster.deployments.find((d) => d.name === "telemetry")!.probePort = 8080;
  stepTo(sim, 20);
  sim.cluster.configMaps.find((c) => c.name === "ward-config")!.data["wards.enabled"] = "icu,maternity";
  stepTo(sim, 40);
  run(sim, "kubectl scale deployment/telemetry --replicas=5");
  finish(sim, "[10] Heartbeat Monitors", 80);
}

{ // CKAD4
  const sim = start(byId(11));
  stepTo(sim, 2);
  run(sim, "kubectl set image deployment/patient-records records=patient-records:5.0");
  stepTo(sim, 10);
  run(sim, "kubectl rollout undo deployment/patient-records");
  stepTo(sim, 90);
  run(sim, "kubectl set image deployment/patient-records records=patient-records:5.1");
  stepTo(sim, 110);
  run(sim, "kubectl scale deployment/patient-records --replicas=5");
  run(sim, "k rollout status deployment/patient-records");
  finish(sim, "[11] Records Rollout", 150);
}

{ // CKAD5
  const sim = start(byId(12));
  stepTo(sim, 2);
  applyYaml(sim.cluster, sim.level.files!["natl-health-api.yaml"].replace("apiToken:", "api-token:"));
  stepTo(sim, 20);
  run(sim, `kubectl patch service oxygen-svc -p '{"spec":{"selector":{"app":"oxygen-scheduler"}}}'`);
  stepTo(sim, 25);
  run(sim, "kubectl scale deployment/gift-shop --replicas=1");
  run(sim, "kubectl scale deployment/triage-desk --replicas=6");
  stepTo(sim, 45);
  run(sim, "kubectl scale deployment/lab-analyzer --replicas=4");
  finish(sim, "[12] Outbreak Protocol", 90);
}

/* ------------------------ slow player (stress) ------------------------ */

console.log("\n— Slow player (all events fire before the player acts) —");

{ // L1 — act only after the town-crier event (45)
  const sim = start(byId(1));
  stepTo(sim, 60);
  run(sim, "kubectl get pods"); run(sim, "kubectl get nodes");
  stepTo(sim, 63);
  run(sim, `kubectl logs ${podNamed(sim, "bakery-web-")}`);
  stepTo(sim, 66);
  run(sim, "kubectl rollout undo deployment/bakery-web");
  stepTo(sim, 85);
  run(sim, "kubectl scale deployment/bakery-web --replicas=3");
  finish(sim, "[1] slow", 120);
}

{ // L2 — act only after both events (40, 80)
  const sim = start(byId(2));
  stepTo(sim, 90);
  run(sim, "kubectl get svc");
  stepTo(sim, 93);
  run(sim, `kubectl patch service ticket-svc -p '{"spec":{"selector":{"app":"ticket-shop"}}}'`);
  stepTo(sim, 105);
  run(sim, "kubectl set image deployment/poster-maker poster-maker=poster-maker:2.0");
  stepTo(sim, 125);
  run(sim, "kubectl scale deployment/ticket-shop --replicas=6");
  finish(sim, "[2] slow", 165);
}

{ // L3 — act only after worker-2 auto-recovers (110)
  const sim = start(byId(3));
  stepTo(sim, 120);
  run(sim, "kubectl get nodes");
  stepTo(sim, 123);
  run(sim, "kubectl drain worker-2 --ignore-daemonsets");
  stepTo(sim, 135);
  run(sim, "kubectl uncordon worker-2");
  finish(sim, "[3] slow", 160);
}

{ // L4 — diagnose, rollback and triage all after the spree (70)
  const sim = start(byId(4));
  stepTo(sim, 80);
  run(sim, `kubectl logs ${podNamed(sim, "payments-")}`);
  stepTo(sim, 82);
  run(sim, "kubectl rollout undo deployment/payments");
  stepTo(sim, 110);
  run(sim, "kubectl scale deployment/analytics --replicas=5");
  finish(sim, "[4] slow", 170);
}

{ // L5 — never drain during the storm; act only after it passes (150)
  const sim = start(byId(5));
  stepTo(sim, 160);
  run(sim, "kubectl drain worker-3 --ignore-daemonsets");
  run(sim, "kubectl drain worker-4 --ignore-daemonsets");
  stepTo(sim, 165);
  run(sim, "kubectl scale deployment/hospital --replicas=5");
  stepTo(sim, 170);
  run(sim, "kubectl scale deployment/arcade --replicas=2");
  stepTo(sim, 200);
  run(sim, "kubectl uncordon worker-3");
  run(sim, "kubectl uncordon worker-4");
  run(sim, "kubectl scale deployment/arcade --replicas=5");
  finish(sim, "[5] slow", 260);
}

{ // L6 — apply blueprints only after both events (50, 130)
  const sim = start(byId(6));
  stepTo(sim, 140);
  applyYaml(sim.cluster, sim.level.files!["library.yaml"]
    .replace('replicas: "two"', "replicas: 2")
    .replace("app: library\n", "app: library-web\n"));
  stepTo(sim, 145);
  run(sim, "kubectl set image deployment/library-web web=library-web:1.2");
  stepTo(sim, 158);
  applyYaml(sim.cluster, sim.level.files!["catalog.yaml"]);
  stepTo(sim, 170);
  run(sim, "kubectl scale deployment/library-web --replicas=3");
  finish(sim, "[6] slow", 210);
}

{ // L7 — act only after the Queen lands (150)
  const sim = start(byId(7));
  stepTo(sim, 160);
  run(sim, `kubectl logs ${podNamed(sim, "town-banners-")}`);
  run(sim, `kubectl describe pod ${podNamed(sim, "welcome-hall-")}`);
  stepTo(sim, 163);
  sim.cluster.configMaps.find((c) => c.name === "banner-config")!.data["royal.theme"] = "cumulus-gold";
  stepTo(sim, 185);
  sim.cluster.deployments.find((d) => d.name === "welcome-hall")!.probePort = 8080;
  stepTo(sim, 200);
  run(sim, "kubectl scale deployment/welcome-hall --replicas=4");
  finish(sim, "[7] slow", 240);
}

{ // CKAD1 — act only after the flu event (90)
  const sim = start(byId(8));
  stepTo(sim, 100);
  run(sim, "k get pods"); run(sim, "k get nodes");
  stepTo(sim, 103);
  applyYaml(sim.cluster, sim.level.files!["admissions.yaml"].replace("app: admissions-desk", "app: admissions"));
  stepTo(sim, 115);
  run(sim, "kubectl scale deployment/admissions-web --replicas=4");
  finish(sim, "[8] slow", 145);
}

{ // CKAD2 — act only after the audit event (120)
  const sim = start(byId(9));
  stepTo(sim, 130);
  run(sim, `kubectl logs ${podNamed(sim, "pharmacy-")}`);
  stepTo(sim, 133);
  sim.cluster.configMaps.find((c) => c.name === "formulary-config")!.data["formulary.version"] = "2026-week-29";
  stepTo(sim, 155);
  applyYaml(sim.cluster, sim.level.files!["prescriptions.yaml"]);
  stepTo(sim, 160);
  sim.cluster.deployments.find((d) => d.name === "prescriptions")!.secretRef = { name: "pharmacy-db", key: "password" };
  finish(sim, "[9] slow", 200);
}

{ // CKAD3 — act only after Code Yellow (140)
  const sim = start(byId(10));
  stepTo(sim, 150);
  run(sim, "k get events");
  stepTo(sim, 153);
  sim.cluster.deployments.find((d) => d.name === "telemetry")!.probePort = 8080;
  stepTo(sim, 170);
  sim.cluster.configMaps.find((c) => c.name === "ward-config")!.data["wards.enabled"] = "icu,maternity";
  stepTo(sim, 190);
  run(sim, "kubectl scale deployment/telemetry --replicas=5");
  finish(sim, "[10] slow", 230);
}

{ // CKAD4 — player ignores the release until after the hotfix exists (85)
  const sim = start(byId(11));
  stepTo(sim, 90);
  run(sim, "kubectl set image deployment/patient-records records=patient-records:5.0");
  stepTo(sim, 100);
  run(sim, "kubectl rollout undo deployment/patient-records");
  stepTo(sim, 125);
  run(sim, "kubectl set image deployment/patient-records records=patient-records:5.1");
  stepTo(sim, 150);
  run(sim, "kubectl scale deployment/patient-records --replicas=5");
  run(sim, "k rollout status deployment/patient-records");
  finish(sim, "[11] slow", 190);
}

{ // CKAD5 — act only after the samples event (150)
  const sim = start(byId(12));
  stepTo(sim, 160);
  applyYaml(sim.cluster, sim.level.files!["natl-health-api.yaml"].replace("apiToken:", "api-token:"));
  stepTo(sim, 175);
  run(sim, `kubectl patch service oxygen-svc -p '{"spec":{"selector":{"app":"oxygen-scheduler"}}}'`);
  stepTo(sim, 180);
  run(sim, "kubectl scale deployment/gift-shop --replicas=1");
  run(sim, "kubectl scale deployment/triage-desk --replicas=6");
  stepTo(sim, 205);
  run(sim, "kubectl scale deployment/lab-analyzer --replicas=4");
  finish(sim, "[12] slow", 250);
}

/* -------------------------------- exit -------------------------------- */

console.log(failures === 0 ? "\nALL MISSION SCENARIOS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
