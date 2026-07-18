# ☸️ Kubetopia — an animated Kubernetes simulator game

Kubetopia is a browser game for practicing **Kubernetes administration** — debugging,
incident response, YAML manifests and capacity planning — the way Cisco Packet Tracer lets
you practice networking. You play the new SRE of **Kubetopia**, a cartoon 3D island town
whose every building is a node and every glowing crate is a pod. Real `kubectl` commands
drive a **simulated cluster**; when workloads fail, the townsfolk get unhappy, and it's on
you to fix things before the happiness meter bottoms out.

Kubetopia is part of **[KubeQuest](https://kubequest.org)** (CKA/CKAD study plans) and
lives at **[play.kubequest.org](https://play.kubequest.org)**. One Google sign-in works for
both — but the game is fully playable signed-out, with progress in `localStorage`.

Built with **Next.js (App Router) + TypeScript + Three.js** (via react-three-fiber).
The whole cluster simulation runs client-side.

## The campaign

| # | Level | Real-world skill you practice |
|---|-------|-------------------------------|
| 1 | **First Shift at Kubetopia** | `get`/`describe`/`logs`, fixing a `CrashLoopBackOff` (bad image), scaling a Deployment |
| 2 | **The Grand Festival Fiasco** | Services & label selectors (a selector typo = outage), fixing `ImagePullBackOff`, surge scaling |
| 3 | **Blackout at Midnight** | Node `NotReady` failures, pod eviction, the `cordon`→`drain`→`uncordon` cycle, reading events |
| 4 | **The Cursed Deploy** | `rollout undo` rollbacks, resource-request capacity math, unschedulable `Pending` pods |
| 5 | **Storm Over Kubetopia** | Cascading node failures, triage under scarce capacity, prioritizing critical workloads |
| 6 | **The Grand Library** | Writing & fixing **YAML manifests**, `kubectl apply -f`, selector/label invariants, the live YAML editor |
| 7 | **The Cloud Queen's Inspection** | **ConfigMaps** (crash on missing key), **readiness probes** (Running ≠ Ready), `kubectl edit` |

Each level opens with a short story told by a cast of portrait characters (Mayor Beatrix,
Old Sal the retired SRE, the Cloud Queen…), reveals objectives one at a time, fires scripted
incidents, and scores you on objectives + a speed bonus (1–3 stars). Later levels unlock as
you win; signed-in players get their progress synced across devices via Firestore.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (all level pages are statically generated)
npm run start    # serve the production build
npm run lint
```

`NEXT_PUBLIC_SITE_URL` controls canonical URLs/sitemap/robots (defaults to
`https://play.kubequest.org`). The Firebase web config ships with safe public defaults for
the shared `kubequest-dd648` project; override with `NEXT_PUBLIC_FIREBASE_*` env vars to
point a fork at a different project (see `src/lib/firebase/client.ts`).

## Firebase: shared project with KubeQuest

- **Auth**: Google sign-in via the same Firebase project as kubequest.org, so one account
  spans both apps. Add `play.kubequest.org` to **Auth → Settings → Authorized domains** in
  the Firebase console before going live.
- **Firestore**: game saves live in `kubetopia/{uid}` — a separate top-level collection so
  they can never collide with KubeQuest's `users/{uid}` study data. The matching security
  rule lives in the KubeQuest repo's `firestore.rules` (deploy with
  `firebase deploy --only firestore:rules` from that repo).
- **Sync model**: localStorage is always the source of truth for instant play; on sign-in
  the local and cloud saves are merged (best of each) and kept in sync from then on.

## Deploying (Firebase App Hosting)

`apphosting.yaml` configures the App Hosting backend. One-time setup in the Firebase
console: **App Hosting → Create backend → connect `CuriouserLabs/Kubetopia`, live branch
`main`** — after that, every push to `main` builds and deploys automatically. Then map the
custom domain `play.kubequest.org` under App Hosting → Domains.

### SEO on a subdomain

The game keeps its own metadata, `VideoGame` JSON-LD, `sitemap.xml` and `robots.txt` — a
subdomain is a separate site in Google's eyes, so nothing in kubequest.org's existing
sitemap needs to change. One-time steps: add a Search Console property for
`play.kubequest.org` (or upgrade to a Domain property for `kubequest.org`, which covers all
subdomains) and submit `https://play.kubequest.org/sitemap.xml`. The landing pages
cross-link both ways, which helps discovery.

## Architecture

The design keeps the **simulation** (pure, framework-free TypeScript), the **content**
(level definitions), the **state glue** (a Zustand store) and the **presentation** (React +
Three.js) in separate layers, so you can add levels or commands without touching the renderer.

```
src/
├── app/                      # Next.js App Router: routing, SEO, metadata
│   ├── page.tsx              #   landing page (VideoGame JSON-LD, level select)
│   ├── play/[slug]/page.tsx  #   a level (SSG via generateStaticParams; per-level metadata)
│   ├── sitemap.ts robots.ts  #   SEO endpoints
│   └── globals.css           #   all styling (cartoon UI + terminal + 3D labels)
│
├── lib/
│   ├── k8s/                  # THE SIMULATOR — no React, no DOM, unit-testable
│   │   ├── types.ts          #   Cluster / Node / Pod / Deployment / Service models
│   │   ├── engine.ts         #   tick()-based control loop: reconcile, schedule, lifecycle, evict
│   │   └── kubectl.ts        #   forgiving kubectl parser (get/describe/logs/scale/set image/
│   │                         #     rollout/cordon/drain/patch/…) returning terminal output
│   └── levels/               # THE CONTENT — each level is data + objective predicates
│       ├── types.ts helpers.ts
│       └── level1..7.ts, index.ts
│
├── store/
│   └── gameStore.ts          # Zustand: owns the cluster, runs the tick loop, evaluates
│                             #   objectives sequentially, tracks score/happiness/progress
│
└── components/
    ├── three/                # react-three-fiber scene
    │   ├── ClusterScene.tsx  #   canvas, lighting/mood driven by happiness, node layout
    │   ├── NodeBuilding.tsx  #   a node as a building; pods as glowing crates; fire+smoke when down
    │   ├── Traffic.tsx       #   request-packets flying gateway→healthy pods (density = health)
    │   └── Scenery.tsx       #   island, trees, clouds, gateway tower
    ├── ui/                   # HUD, ObjectivesPanel, Terminal, story/victory modals, toasts
    ├── game/GameView.tsx     # composes the scene + sidebar, owns the 1s tick interval
    └── LevelSelect.tsx       # level grid with unlock/stars from persisted progress
```

### How the simulation works

`engine.ts` runs a tiny **reconciliation loop**, one `tick()` ≈ one second, mirroring real
kube controllers:

1. **Deployment reconciliation** — create/delete pods to match desired replicas.
2. **Scheduler** — bind `Pending` pods to a `Ready`, uncordoned node with free CPU/memory
   (requests are real; over-commit ⇒ pods stay `Pending`, exactly like the real thing).
3. **Pod lifecycle** — `Pending`→`ContainerCreating`→`Running`/`ImagePullBackOff`, crash loops
   with exponential-ish backoff, and pods on a dead node going `Unknown` then being evicted
   after a long grace period (which is why `drain` matters).
4. **Reaping** — terminated pods are removed.

Failure modes are data: an image in the simulated registry can be missing (`ImagePullBackOff`)
or `crashes: true` (`CrashLoopBackOff`); a Service selector can be mistyped; a node can be
failed by a scripted event. Objectives are **predicates over cluster state + command history**,
so "fix it" means genuinely reaching the healthy state — not typing a magic command.

### Adding a level

Create `src/lib/levels/levelN.ts` exporting a `LevelDef` (`buildCluster`, `objectives`,
scripted `events`, story text, `parTicks`) and add it to `LEVELS` in `levels/index.ts`.
Routing, SEO metadata, the sitemap and the level-select grid pick it up automatically.

### Adding a `kubectl` command

Extend the `switch` in `lib/k8s/kubectl.ts` and, if needed, add a mutation helper in
`engine.ts`. The terminal and objective checks need no changes.

## Tech & SEO notes

- **Rendering:** the landing page and all `/play/[slug]` shells are statically generated;
  the WebGL scene is a `dynamic(..., { ssr: false })` island so the game never blocks SSR.
- **SEO:** per-page `metadata`, Open Graph/Twitter cards, `VideoGame` structured data,
  `sitemap.xml` and `robots.txt` are all generated from the level list.
- **Accessibility/UX:** keyboard-driven console with command history (↑/↓), `help` and `hint`
  built in, ARIA live regions for toasts, and a responsive layout that stacks on mobile.

Kubetopia is a **learning simulator**: the cluster is simulated, but the incidents are real
patterns you'll meet in production. Pair it with the official
[Kubernetes documentation](https://kubernetes.io/docs/home/).
