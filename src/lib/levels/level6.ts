import { emptyCluster, makeDeployment, makeNode, serviceHealth } from "../k8s/engine";
import { deploymentHealthy } from "./helpers";
import type { LevelDef } from "./types";

/**
 * Level 6 — YAML manifests. The player applies a blueprint with three
 * classic mistakes (string replicas, selector/label mismatch, image typo),
 * fixing them in the YAML editor the way real operators do.
 */

const LIBRARY_YAML = `# library.yaml — blueprint for the Grand Library of Kubetopia
# Drafted late at night by Architect Elowen. She suspects it has flaws.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: library-web
spec:
  replicas: "two"
  selector:
    matchLabels:
      app: library
  template:
    metadata:
      labels:
        app: library-web
    spec:
      containers:
        - name: web
          image: library-web:1.20
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
  name: library-svc
spec:
  selector:
    app: library-web
  ports:
    - port: 80
`;

const CATALOG_YAML = `# catalog.yaml — the library's card catalog service
apiVersion: apps/v1
kind: Deployment
metadata:
  name: catalog
spec:
  replicas: 2
  selector:
    matchLabels:
      app: catalog
  template:
    metadata:
      labels:
        app: catalog
    spec:
      containers:
        - name: catalog
          image: catalog:2.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: catalog-svc
spec:
  selector:
    app: catalog
  ports:
    - port: 80
`;

const level6: LevelDef = {
  id: 6,
  slug: "the-grand-library",
  name: "The Grand Library",
  tagline: "Raise a whole new building from blueprints — if the YAML lets you.",
  skills: ["writing & fixing YAML manifests", "kubectl apply -f", "selectors vs labels in specs"],
  story: [
    {
      speaker: "architect",
      text: "Ah, the famous SRE! I'm Elowen, town architect. The mayor commissioned a Grand Library — and in Kubetopia, we don't lay bricks. We apply blueprints. YAML blueprints.",
    },
    {
      speaker: "architect",
      text: "I drafted library.yaml at three in the morning after the town council meeting. Between us: I was seeing double. The API server will reject what it can — but some mistakes only show up after the walls go up.",
    },
    {
      speaker: "mentor",
      text: "YAML lessons, kid: replicas is a NUMBER, not a word. A Deployment's selector must match its template labels exactly. And check every image tag against the registry twice. Run `cat library.yaml`, then `kubectl apply -f library.yaml` — the editor will let you fix it before applying.",
    },
  ],
  outro:
    "The Grand Library opens with a ribbon (and a rollback plan). Elowen frames the corrected YAML and hangs it in the reading room, under a plaque: 'The selector must match the labels. — ancient proverb'. The catalog hums, the shelves fill, and Kubetopia becomes a town of readers.",
  parTicks: 220,
  files: {
    "library.yaml": LIBRARY_YAML,
    "catalog.yaml": CATALOG_YAML,
  },
  buildCluster: () => {
    const c = emptyCluster();
    c.nodes.push(
      makeNode("control-plane", { roles: "control-plane" }),
      makeNode("worker-1"),
      makeNode("worker-2"),
      makeNode("worker-3")
    );
    c.registry = {
      "bakery-web:1.4": { exists: true, logs: ["bakery-web 1.4 — croissants flowing"] },
      "library-web:1.2": {
        exists: true,
        logs: ["library-web 1.2: shelves indexed", "listening on :8080", "shhh — this is a library"],
      },
      // library-web:1.20 deliberately absent — the classic tag typo
      "catalog:2.0": { exists: true, logs: ["catalog 2.0: 40,000 cards sorted"] },
    };
    c.deployments.push(makeDeployment("bakery-web", { replicas: 2, image: "bakery-web:1.4" }));
    c.services.push({ name: "bakery-svc", selectorApp: "bakery-web", port: 80 });
    return c;
  },
  objectives: [
    {
      id: "blueprint",
      title: "Unroll the blueprints",
      description:
        "Read the architect's draft (`cat library.yaml`), then take it to the API server with `kubectl apply -f library.yaml`. Fix what the server rejects — replicas must be a number, and the selector must match the template labels.",
      points: 200,
      hint: 'Run `kubectl apply -f library.yaml`. In the editor: change replicas to 2 (a number, no quotes) and make spec.selector.matchLabels.app say "library-web" so it matches the template. Then press Apply.',
      check: (ctx) =>
        ctx.cluster.deployments.some((d) => d.name === "library-web") &&
        ctx.cluster.services.some((s) => s.name === "library-svc"),
    },
    {
      id: "shelves",
      title: "Raise the reading halls",
      description:
        "The deployment applied, but the pods can't pull their image. Find the tag typo and fix it — in the YAML (`kubectl edit deployment/library-web`) or however you like. Two halls (replicas), both Ready.",
      points: 300,
      hint: "`kubectl get pods` shows ImagePullBackOff. The registry has library-web:1.2 — the blueprint says 1.20. `kubectl edit deployment/library-web` and correct the image tag.",
      check: (ctx) => {
        const d = ctx.cluster.deployments.find((x) => x.name === "library-web");
        return !!d && ctx.cluster.registry[d.image]?.exists === true && deploymentHealthy(ctx.cluster, "library-web", 2);
      },
    },
    {
      id: "catalog",
      title: "Stock the card catalog",
      description:
        "A library without a catalog is a book maze. Apply catalog.yaml — Elowen wrote this one after coffee, so trust it a little more.",
      points: 200,
      hint: "Run `kubectl apply -f catalog.yaml`, review, Apply. Then watch `kubectl get pods` until 2/2 Ready.",
      check: (ctx) =>
        deploymentHealthy(ctx.cluster, "catalog", 2) && serviceHealth(ctx.cluster, "catalog-svc") >= 1,
    },
    {
      id: "opening",
      title: "Grand opening",
      description:
        "Opening day crowds incoming: the library needs a third reading hall. Scale it — in YAML or with kubectl scale — and keep everything green.",
      points: 250,
      hint: "`kubectl scale deployment/library-web --replicas=3` (or edit the YAML and re-apply). All library-web and catalog pods Ready.",
      check: (ctx) =>
        deploymentHealthy(ctx.cluster, "library-web", 3) &&
        deploymentHealthy(ctx.cluster, "catalog", 2) &&
        serviceHealth(ctx.cluster, "library-svc") >= 1,
    },
  ],
  events: [
    {
      atTick: 50,
      title: "📐 Architect's confession",
      speaker: "architect",
      story:
        "I just found my night-shift notes... I may have written the replica count in WORDS. And possibly invented an image tag. If the server rejects the blueprint, the editor is your drafting table — fix it there and re-apply.",
    },
    {
      atTick: 130,
      title: "📚 Queue at the doors",
      speaker: "crier",
      story:
        "HEAR YE! Half the island is queuing outside the Grand Library — the other half is already inside whispering too loudly! Opening day will need a third reading hall!",
    },
  ],
};

export default level6;
