import { createPodFor, emptyCluster, makeDeployment, makeNode, serviceHealth } from "../k8s/engine";
import { deploymentHealthy, ranCommand } from "./helpers";
import type { LevelDef } from "./types";

/**
 * CKAD Mission 2 — app configuration. The pharmacy crashes on a missing
 * ConfigMap key, then the prescriptions vault teaches Secrets: the blueprint
 * references a secret by the wrong name, and the pods say so loudly.
 */

const PRESCRIPTIONS_YAML = `# prescriptions.yaml — the prescriptions vault (handles controlled medicines)
# The vault app needs the pharmacy database password from a Secret.
apiVersion: v1
kind: Secret
metadata:
  name: pharmacy-db
type: Opaque
stringData:
  password: cobalt-mortar-77
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prescriptions
spec:
  replicas: 2
  selector:
    matchLabels:
      app: prescriptions
  template:
    metadata:
      labels:
        app: prescriptions
    spec:
      containers:
        - name: vault
          image: prescriptions:1.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
          env:
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: pharmacy-db-pass
                  key: password
---
apiVersion: v1
kind: Service
metadata:
  name: prescriptions-svc
spec:
  selector:
    app: prescriptions
  ports:
    - port: 443
`;

const ckad2: LevelDef = {
  id: 9,
  slug: "the-pharmacy-formulary",
  name: "The Pharmacy Formulary",
  tagline: "Pills without config are just guesses — and the vault won't open without its Secret.",
  track: "ckad",
  skills: ["ConfigMaps & env variables", "Secrets & secretKeyRef", "debugging CrashLoopBackOff"],
  story: [
    {
      speaker: "doctor",
      text: "Emergency! The pharmacy app updated overnight and now it won't start — it just crashes and restarts, crashes and restarts. Nurse Holly is dosing by memory and MY memory says that's terrifying.",
    },
    {
      speaker: "kublet",
      text: "Beep! Diagnosis 101: a pod in CrashLoopBackOff usually tells you why in its logs. `kubectl get pods`, pick a crashing pharmacy pod, then `kubectl logs <pod>` — the app will name exactly what it's missing.",
    },
    {
      speaker: "mentor",
      text: "And a heads-up, kid: the new prescriptions vault ships today too. Its blueprint needs a Secret — passwords do NOT go in ConfigMaps, ever. I once saw a database password in a ConfigMap. I still have nightmares.",
    },
  ],
  outro:
    "The formulary loads, the vault clicks open, and Nurse Holly stops dosing by memory. Dr. Iris institutes a new hospital rule, engraved on a brass plaque: 'Config in ConfigMaps, passwords in Secrets, and never the other way around.' The pharmacy queue has never moved faster.",
  parTicks: 210,
  files: {
    "prescriptions.yaml": PRESCRIPTIONS_YAML,
  },
  buildCluster: () => {
    const c = emptyCluster();
    c.nodes.push(
      makeNode("control-plane", { roles: "control-plane" }),
      makeNode("worker-1"),
      makeNode("worker-2")
    );
    c.registry = {
      "admissions-web:1.0": { exists: true, logs: ["admissions-web 1.0: intake forms loaded"] },
      "pharmacy:3.1": {
        exists: true,
        logs: ["pharmacy 3.1: shelving 4,000 medicines", "listening on :8080"],
      },
      "prescriptions:1.0": {
        exists: true,
        logs: ["prescriptions 1.0: vault door oiled", "audit log enabled", "listening on :8080"],
      },
    };
    c.configMaps.push({
      name: "formulary-config",
      // The key the app needs — formulary.version — is conspicuously absent.
      data: { "pharmacy.theme": "mint-green", "opening.hours": "08:00-20:00" },
    });
    const admissions = makeDeployment("admissions-web", { replicas: 2, image: "admissions-web:1.0" });
    const pharmacy = makeDeployment("pharmacy", {
      replicas: 2,
      image: "pharmacy:3.1",
      configRef: { name: "formulary-config", key: "formulary.version" },
    });
    c.deployments.push(admissions, pharmacy);
    c.services.push(
      { name: "admissions-svc", selectorApp: "admissions-web", port: 80 },
      { name: "pharmacy-svc", selectorApp: "pharmacy", port: 80 }
    );
    // Pre-seed the crash loop so the outage greets the player immediately.
    for (let i = 0; i < 2; i++) {
      const p = createPodFor(c, pharmacy);
      p.nodeName = i === 0 ? "worker-1" : "worker-2";
      p.phase = "CrashLoopBackOff";
      p.restarts = 5 + i;
      p.backoff = 8;
    }
    return c;
  },
  objectives: [
    {
      id: "diagnose",
      title: "Read the symptoms",
      description:
        "The pharmacy pods are crash-looping. Read a pod's logs or describe it — the app names the exact config it can't live without.",
      points: 150,
      hint: "`kubectl get pods`, then `kubectl logs <pharmacy-pod>`. It will complain about a missing key in ConfigMap formulary-config.",
      check: (ctx) =>
        ranCommand(ctx, /kubectl\s+(logs|describe\s+(po|pod|pods))\s+pharmacy-/),
    },
    {
      id: "formulary",
      title: "Restock the formulary",
      description:
        "The app requires the key `formulary.version` in ConfigMap formulary-config. Add it — any value, the pharmacists update it weekly — and get both pharmacy pods Ready.",
      points: 250,
      hint: '`kubectl edit configmap formulary-config` and add a line under data:, e.g. `formulary.version: "2026-week-29"`. The pods pick it up on their next restart.',
      check: (ctx) => {
        const cm = ctx.cluster.configMaps.find((x) => x.name === "formulary-config");
        return !!cm && "formulary.version" in cm.data && deploymentHealthy(ctx.cluster, "pharmacy", 2);
      },
    },
    {
      id: "vault",
      title: "Install the prescriptions vault",
      description:
        "Apply prescriptions.yaml — it ships a Secret, a Deployment and a Service in one blueprint. Applying is the easy part...",
      points: 200,
      hint: "Run `kubectl apply -f prescriptions.yaml`, review it in the editor, press Apply. Then check `kubectl get pods` — do the vault pods actually start?",
      check: (ctx) =>
        ctx.cluster.deployments.some((d) => d.name === "prescriptions") &&
        ctx.cluster.secrets.length > 0,
    },
    {
      id: "unlock",
      title: "Open the vault for business",
      description:
        "The vault pods are crashing: the Deployment asks for a Secret that doesn't quite exist. Make the names line up — then both replicas Ready and prescriptions-svc serving.",
      points: 300,
      hint: 'The Secret is named "pharmacy-db" but the Deployment\'s secretKeyRef says "pharmacy-db-pass". `kubectl get secrets` to confirm, then fix either side — e.g. `kubectl edit deployment/prescriptions` and correct the secret name.',
      check: (ctx) => {
        const d = ctx.cluster.deployments.find((x) => x.name === "prescriptions");
        if (!d || !d.secretRef) return false;
        const sec = ctx.cluster.secrets.find((s) => s.name === d.secretRef!.name);
        return (
          !!sec &&
          d.secretRef.key in sec.data &&
          deploymentHealthy(ctx.cluster, "prescriptions", 2) &&
          serviceHealth(ctx.cluster, "prescriptions-svc") >= 1
        );
      },
    },
  ],
  events: [
    {
      atTick: 45,
      title: "💊 Nurse Holly's note",
      speaker: "doctor",
      story:
        "Nurse Holly reports the pharmacy shelves are fine — it's the FORMULARY the app can't find. Apparently version 3.1 refuses to guess dosages without its config. Honestly? Good for it.",
    },
    {
      atTick: 120,
      title: "📜 Controlled substances audit",
      speaker: "crier",
      story:
        "HEAR YE! The island's Controlled Medicines Inspector docks at noon! If the prescriptions vault is not online and serving, the hospital gets a STERN CLIPBOARD REVIEW!",
    },
  ],
};

export default ckad2;
