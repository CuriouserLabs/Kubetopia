# ☸️ Kubetopia — an animated Kubernetes simulator game

Kubetopia is a browser game for practicing **Kubernetes** the way Cisco Packet Tracer lets you
practice networking. You play the on-call engineer for **Kubetopia**, a cartoon 3D island town
where every building is a node and every glowing crate is a pod. Real `kubectl` commands drive a
**simulated cluster** — when workloads fail, the townsfolk get unhappy, and it's on you to fix
things before the happiness meter bottoms out.

Play it at **[play.kubequest.org](https://play.kubequest.org)**. It's a companion to
**[KubeQuest](https://kubequest.org)** (CKA/CKAD study plans) and shares one Google sign-in —
but the game is fully playable signed-out, with progress saved to `localStorage`.

- 🎮 **Two campaigns, 12 story-driven missions** — a cluster-admin track and an app-developer
  track, each with its own cast, town and failure modes.
- ⌨️ **A real `kubectl` console** — `get` / `describe` / `logs` / `scale` / `set image` /
  `rollout` / `cordon` / `drain` / `patch` / `apply -f` / `edit`, with aliases (`po`, `deploy`,
  `svc`, `k`), command history and built-in `help` and `hint`.
- 🧩 **A live YAML editor** — `kubectl apply -f` and `kubectl edit` open real manifests that are
  parsed and validated like the API server does (integer `replicas`, selector/label invariants).
- 🏗️ **A 3D town that reacts** — pods appear as crates on node-buildings, traffic flies from the
  gateway to healthy pods, and buildings catch fire when a node goes `NotReady`.
- 🎯 **Objectives are predicates, not scripts** — a mission advances only when the cluster
  genuinely reaches a healthy state, so "fix it" can't be faked by typing a magic command.
- ⭐ **Scoring & progression** — points per objective plus a speed bonus (1–3 stars); missions
  unlock as you win, and signed-in players sync progress across devices via Firestore.

## The campaigns

### 🏙️ The City Campaign — *Path of the Cluster Admin* (CKA-style)

| # | Mission | What you practice |
|---|---------|-------------------|
| 1 | **First Shift at Kubetopia** | `get`/`describe`/`logs`, fixing a `CrashLoopBackOff` (bad image), scaling a Deployment |
| 2 | **The Grand Festival Fiasco** | Services & label selectors (a selector typo = outage), fixing `ImagePullBackOff`, surge scaling |
| 3 | **Blackout at Midnight** | Node `NotReady` failures, pod eviction, the `cordon`→`drain`→`uncordon` cycle, reading events |
| 4 | **The Cursed Deploy** | `rollout undo` rollbacks, resource-request capacity math, unschedulable `Pending` pods |
| 5 | **Storm Over Kubetopia** | Cascading node failures, triage under scarce capacity, prioritizing critical workloads |
| 6 | **The Grand Library** | Writing & fixing **YAML manifests**, `kubectl apply -f`, selector/label invariants |
| 7 | **The Cloud Queen's Inspection** | **ConfigMaps** (crash on a missing key), **readiness probes** (Running ≠ Ready), `kubectl edit` |

### 🏥 The Hospital Campaign — *Path of the App Developer* (CKAD-style)

| # | Mission | What you practice |
|---|---------|-------------------|
| 1 | **Code Blue at Admissions** | Building an app from YAML, `kubectl apply -f`, Deployments & Services |
| 2 | **The Pharmacy Formulary** | ConfigMaps & env vars, **Secrets** & `secretKeyRef`, debugging `CrashLoopBackOff` |
| 3 | **The Heartbeat Monitors** | Readiness probes, Running vs Ready, diagnosing with logs / events / `describe` |
| 4 | **The Records Rollout** | Shipping a release, `rollout undo` under pressure, landing a hotfix, `rollout status` |
| 5 | **Outbreak Protocol** | Multi-fault incident response: Secrets, a broken Service selector, capacity triage |

Each mission opens with a short story told by portrait characters (Mayor Beatrix, Old Sal the
retired SRE, Dr. Iris, the Cloud Queen…), reveals objectives one at a time, and fires scripted
incidents mid-run — a node dies, marketing ships a bad deploy, the storm arrives.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| 3D | Three.js via react-three-fiber / drei |
| State | Zustand |
| Auth | Firebase Authentication (Google sign-in, optional) |
| Database | Cloud Firestore (progress sync for signed-in players) |
| Hosting | Firebase App Hosting |

The entire cluster simulation runs **client-side** — there is no backend to the game itself.
The landing, campaign and mission pages are statically generated; the WebGL scene is loaded as a
`dynamic(..., { ssr: false })` island so the game never blocks rendering.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

The game runs fully without any configuration — Firebase is optional and only powers cross-device
progress sync. `NEXT_PUBLIC_SITE_URL` controls canonical URLs, sitemap and robots (defaults to
`https://play.kubequest.org`). To point a fork at your own Firebase project, set the
`NEXT_PUBLIC_FIREBASE_*` env vars (see [src/lib/firebase/client.ts](src/lib/firebase/client.ts));
game saves live in a `kubetopia/{uid}` collection.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | Production build (all mission pages statically generated) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Mission completability suite: plays every mission headlessly, at both prompt and worst-case timing |
| `npx tsx scripts/generate-brand-assets.tsx` | Regenerate the icons and social share card in `public/` |

## How the simulation works

`lib/k8s/engine.ts` runs a tiny **reconciliation loop**, one `tick()` ≈ one second, mirroring the
real kube controllers:

1. **Deployment reconciliation** — create/delete pods to match desired replicas.
2. **Scheduler** — bind `Pending` pods to a `Ready`, uncordoned node with free CPU/memory
   (requests are real; over-commit ⇒ pods stay `Pending`, exactly like the real thing).
3. **Pod lifecycle** — `Pending`→`ContainerCreating`→`Running`/`ImagePullBackOff`, crash loops with
   exponential-ish backoff, and pods on a dead node going `Unknown` before being evicted after a
   long grace period (which is why `drain` matters).
4. **Reaping** — terminated pods are removed.

Failure modes are **data**: an image in the simulated registry can be missing
(`ImagePullBackOff`) or `crashes: true` (`CrashLoopBackOff`); a Deployment can reference a
ConfigMap/Secret key that doesn't exist; a readiness probe can point at the wrong port; a Service
selector can be mistyped; a node can be failed by a scripted event.

## Project structure

The design keeps the **simulation** (pure, framework-free TypeScript), the **content** (mission
definitions), the **state glue** (a Zustand store) and the **presentation** (React + Three.js) in
separate layers, so you can add missions or commands without touching the renderer.

```
src/
├── app/                          # App Router: routing and metadata
│   ├── page.tsx                  #   landing page (track portals)
│   ├── campaign/[track]/page.tsx #   mission select for a campaign
│   ├── play/[slug]/page.tsx      #   a mission (SSG via generateStaticParams)
│   ├── sitemap.ts robots.ts
│   └── globals.css               #   all styling (cartoon UI + terminal + 3D labels)
│
├── lib/
│   ├── k8s/                      # THE SIMULATOR — no React, no DOM, unit-testable
│   │   ├── types.ts              #   Cluster / Node / Pod / Deployment / Service models
│   │   ├── engine.ts             #   tick()-based control loop: reconcile, schedule, evict
│   │   ├── kubectl.ts            #   forgiving kubectl parser returning terminal output
│   │   └── manifest.ts           #   YAML apply/edit with API-server-style validation
│   ├── levels/                   # THE CONTENT — each mission is data + objective predicates
│   │   ├── types.ts helpers.ts index.ts   # index.ts also defines the campaign tracks
│   │   ├── level1..7.ts           #   city campaign (CKA-style)
│   │   └── ckad1..5.ts            #   hospital campaign (CKAD-style)
│   └── firebase/                 # optional auth + progress sync
│
├── store/
│   ├── gameStore.ts              # owns the cluster, runs the tick loop, evaluates objectives
│   └── authStore.ts
│
└── components/
    ├── three/                    # react-three-fiber scene
    │   ├── ClusterScene.tsx      #   canvas, lighting/mood driven by happiness
    │   ├── NodeBuilding.tsx      #   a node as a building; pods as crates; fire when down
    │   ├── Traffic.tsx           #   request-packets flying gateway→healthy pods
    │   └── Scenery.tsx Townsfolk.tsx
    ├── ui/                       # HUD, ObjectivesPanel, Terminal, YamlEditor, modals, toasts
    ├── game/GameView.tsx         # composes scene + sidebar, owns the 1s tick interval
    └── MissionGrid.tsx           # mission grid with unlock state and stars
```

## Contributing

**Adding a mission.** Create `src/lib/levels/<name>.ts` exporting a `LevelDef` (`buildCluster`,
`objectives`, scripted `events`, story text, `parTicks`, and a `track`) and add it to `LEVELS` in
[src/lib/levels/index.ts](src/lib/levels/index.ts). Routing, metadata, the sitemap and the mission
grid pick it up automatically.

Objective `check` functions are predicates over cluster state **and** command history. Two things
to keep in mind, both learned the hard way:

- Make checks **durable**. If a scripted event later heals the thing you're checking for (a node
  recovering, say), a check that requires the broken state *right now* becomes impossible to
  satisfy and the player is stuck forever.
- Match commands with `ranCommand`, which normalises the `k` alias to `kubectl` — write your regex
  against `kubectl ...`.

Then add the mission to the completability suite ([tests/missions.test.ts](tests/missions.test.ts))
in **both** timing profiles and run `npm test` — the slow-player profile is what catches
objectives that a later scripted event can render impossible.

**Adding a `kubectl` command.** Extend the `switch` in
[src/lib/k8s/kubectl.ts](src/lib/k8s/kubectl.ts) and, if needed, add a mutation helper in
`engine.ts`. The terminal and objective checks need no changes.

---

Kubetopia is a **learning simulator**: the cluster is simulated, but the incidents are real
patterns you'll meet in production. Pair it with the official
[Kubernetes documentation](https://kubernetes.io/docs/home/).
