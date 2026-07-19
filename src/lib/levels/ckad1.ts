import { emptyCluster, makeNode, serviceHealth } from "../k8s/engine";
import { deploymentHealthy, ranCommand } from "./helpers";
import type { LevelDef } from "./types";

/**
 * CKAD Mission 1 — build & deploy an app from YAML. The hospital's paper
 * admissions desk goes digital: apply a blueprint with a classic
 * selector/label mismatch, open the service, scale for flu season.
 */

const ADMISSIONS_YAML = `# admissions.yaml — the digital admissions desk of Kubetopia General
# Drafted by Devin the intern between two espresso shots.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: admissions-web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: admissions-desk
  template:
    metadata:
      labels:
        app: admissions
    spec:
      containers:
        - name: web
          image: admissions-web:1.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: admissions-svc
spec:
  selector:
    app: admissions
  ports:
    - port: 80
`;

const ckad1: LevelDef = {
  id: 8,
  slug: "code-blue-at-admissions",
  name: "Code Blue at Admissions",
  tagline: "The hospital goes digital — if the intern's blueprint compiles.",
  track: "ckad",
  skills: ["building apps from YAML", "kubectl apply -f", "Deployments & Services"],
  story: [
    {
      speaker: "doctor",
      text: "Welcome to Kubetopia General! I'm Dr. Iris. For years our admissions desk has run on paper forms and shouting. Today that changes: the hospital is moving onto the town cluster, and you're the developer on call.",
    },
    {
      speaker: "intern",
      text: "Hi! Devin here — I drafted admissions.yaml for the new intake app! I, um, wrote most of it during a fire drill, so the API server may have opinions. It's on disk: `ls`, then `cat admissions.yaml` to read it.",
    },
    {
      speaker: "mentor",
      text: "App developer rules, kid: look before you apply, and remember a Deployment's selector must match its template labels EXACTLY. When the server rejects a manifest, it's not being rude — it's being right.",
    },
  ],
  outro:
    "The admissions desk hums to life: patient QR codes beep, the waiting room queue finally moves, and the paper forms are ceremonially recycled. Dr. Iris pins your corrected YAML to the staff board like an X-ray of a healed bone. Kubetopia General is officially on the cluster.",
  parTicks: 160,
  files: {
    "admissions.yaml": ADMISSIONS_YAML,
  },
  buildCluster: () => {
    const c = emptyCluster();
    c.nodes.push(
      makeNode("control-plane", { roles: "control-plane" }),
      makeNode("worker-1"),
      makeNode("worker-2")
    );
    c.registry = {
      "admissions-web:1.0": {
        exists: true,
        logs: ["admissions-web 1.0: intake forms loaded", "listening on :8080", "POST /patients 201"],
      },
    };
    return c;
  },
  objectives: [
    {
      id: "rounds",
      title: "Do your rounds",
      description:
        "Before treating a cluster, examine it. List the pods and the nodes — the hospital wing is empty and waiting for its first app.",
      points: 100,
      hint: "Run `kubectl get pods` and `kubectl get nodes`. Then `cat admissions.yaml` to study the blueprint.",
      check: (ctx) =>
        ranCommand(ctx, /kubectl\s+get\s+(po|pod|pods)\b/) &&
        ranCommand(ctx, /kubectl\s+get\s+(no|node|nodes)\b/),
    },
    {
      id: "apply",
      title: "Open the admissions desk",
      description:
        "Apply admissions.yaml. The API server will refuse Devin's draft — read its error, fix the manifest in the editor, and apply again.",
      points: 250,
      hint: 'Run `kubectl apply -f admissions.yaml`. The selector says "admissions-desk" but the template labels say "admissions" — make them match (both "admissions"), then press Apply.',
      check: (ctx) =>
        ctx.cluster.deployments.some((d) => d.name === "admissions-web") &&
        ctx.cluster.services.some((s) => s.name === "admissions-svc"),
    },
    {
      id: "doors",
      title: "Unlock the front doors",
      description:
        "The desk exists — now it must serve. Both replicas Ready and the admissions-svc service routing to them.",
      points: 200,
      hint: "Watch `kubectl get pods` until 2/2 are Ready, then `kubectl get svc` — admissions-svc should show ready endpoints.",
      check: (ctx) =>
        deploymentHealthy(ctx.cluster, "admissions-web", 2) &&
        serviceHealth(ctx.cluster, "admissions-svc") >= 1,
    },
    {
      id: "flu",
      title: "Brace for flu season",
      description:
        "The town crier says half the island is sneezing. Scale admissions-web to 4 replicas so nobody queues in the rain.",
      points: 200,
      hint: "`kubectl scale deployment/admissions-web --replicas=4`, then watch them all go Ready.",
      check: (ctx) => deploymentHealthy(ctx.cluster, "admissions-web", 4),
    },
  ],
  events: [
    {
      atTick: 30,
      title: "📎 Intern's confession",
      speaker: "intern",
      story:
        "So... I just re-read my draft. I *may* have called the app 'admissions-desk' in the selector and 'admissions' in the labels. The API server is going to notice. It always notices.",
    },
    {
      atTick: 90,
      title: "🤧 Town Crier",
      speaker: "crier",
      story:
        "HEAR YE! Achoo! The great island flu has arrived! Queues at the hospital gates! If the admissions desk can't take four streams of patients, the waiting room will overflow into the plaza!",
    },
  ],
};

export default ckad1;
