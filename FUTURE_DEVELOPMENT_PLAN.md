# Kubetopia — Future Development Plan

## From a solo campaign to a living multiplayer world

> **Status**: planning document. Nothing here is built yet. Each step below is
> independently shippable and should be developed **one at a time, in order**.

---

## 1. The vision, elaborated

Today, Kubetopia is a single-player campaign: scripted, story-driven missions in
a cartoon 3D town, running entirely in the browser against a simulated
Kubernetes cluster. The end goal is much bigger:

**Kubetopia becomes an online multiplayer world.** Players sign in and *join the
city* — they see other SREs walking the cobblestones, and the world itself
misbehaves: incidents strike the city **without warning**, every online player
gets hit by the same incident **at the same moment**, and a leaderboard shows
who stabilized their cluster best and fastest. Between city-wide events,
players receive personal surprise challenges (different order and different
scenarios per player — nobody can memorize a walkthrough), take on **daily
challenges** (one shared puzzle per day, worldwide), and travel to new places
beyond the cobblestone city — each district with its own flavor of trouble.

The existing story campaign is **not replaced — it is promoted**: it becomes
the canonical **introduction to the game**. New players learn the console, the
town, and the cast by playing the campaign, **with no login required**, exactly
as today. Students who never touch multiplayer still get the full learning
value. Multiplayer is the endgame for players who want competition, community,
and an endless stream of fresh incidents.

### What this changes technically

The game stops being purely local. It will need:

- **Accounts & identity** — already in place (Firebase Auth shared with
  kubequest.org).
- **An API service** — server-side logic the client cannot be trusted with:
  issuing challenge seeds, accepting result submissions, computing
  leaderboards, scheduling city-wide events. (Firebase Cloud Functions /
  Cloud Run, or Next.js route handlers on App Hosting with the Admin SDK —
  decided in Step 2.)
- **A database** — player profiles, runs, challenge definitions, leaderboards,
  presence. (Firestore, already in the stack; Realtime Database for presence.)
- **A fairness model** — if there are leaderboards, there will be cheaters. The
  design below bakes fairness in from Step 1 (deterministic simulation +
  replayable command logs) rather than bolting it on later.

### The one big architectural insight

**The cluster simulation stays 100% client-side.** The server never simulates
Kubernetes — it only *coordinates*: it says "here is scenario seed X, go", the
client runs the deterministic simulation locally and submits a **command log +
result**. Because the engine is deterministic given (scenario seed, command
log, command ticks), the server — or any other client — can **replay the log
to verify the score**. This keeps server costs near zero, keeps offline play
working forever, and gives us anti-cheat and shareable replays almost for free.

---

## 2. Games to study

| Game / platform | What to study | Why it maps to Kubetopia |
|---|---|---|
| **Screeps** (screeps.com) | A persistent MMO world driven by player code; server validates, clients act | The closest existing thing to "engineering skill as multiplayer gameplay"; study its tick model and how it keeps a persistent world fair |
| **SadServers** (sadservers.com) | Timed, self-contained troubleshooting scenarios ("LeetCode for Linux") | Almost exactly our challenge unit: broken system + clock + defined "fixed" condition; study scenario framing and difficulty tiers |
| **Wordle / Advent of Code** | One shared puzzle per day, same for everyone; shareable results | The Daily Challenge model in Step 2; "same seed for the whole world per day" creates community without real-time infrastructure |
| **Tetris 99 / Fall Guys** | An event hits every online player simultaneously; ranked outcome | The city-wide incident model in Step 3: simultaneous start, individual performance, one leaderboard |
| **TypeRacer** | Same task, compete on speed/accuracy; instant rematch loop | Leaderboard psychology: short runs, visible ranks, "one more try" |
| **Overcooked** | Escalating chaos under time pressure that stays fun | Pacing and *feel* of stacked incidents; pressure without misery |
| **SimCity / Cities: Skylines** (disasters) | Random disasters striking a city the player cares about | Our emotional core — the town reacting (fires, sad villagers) is why players care about a CrashLoopBackOff |
| **Habbo Hotel / Club Penguin** | Cozy shared-town presence: avatars, rooms, light social play | The "join the city" feeling in Step 3 — ambient community without heavy MMO netcode |
| **KillerCoda / KodeKloud challenges** | Kubernetes-specific challenge UX, hints, validation checks | How others phrase k8s objectives and hints for learners |

---

## 3. Non-negotiable implementation principles

Any AI agent (or human) implementing this plan **must**:

1. **Preserve the current missions and story.** The existing campaign — the
   town, Mayor Beatrix, Old Sal, Kublet, the Cloud Queen, every scripted
   mission — is the permanent, canonical introduction to the game. It must
   remain playable **without login** and fully offline, exactly as it is
   today: the entry point where learners get familiar with the game before
   (or instead of) ever joining the multiplayer world. Refactors may move its
   code; its content and its no-login guarantee are untouchable.
2. **Maintain the scalable, maintainable architecture and folder structure.**
   The layering that exists today is the contract:
   - `src/lib/k8s/` — pure simulation: no React, no network, deterministic;
   - `src/lib/levels/` (growing into `src/lib/scenarios/`) — content as data;
   - `src/store/` — state glue (Zustand);
   - `src/components/` — presentation only;
   - `src/app/` — routing/SEO.
   New capabilities get new modules beside these (`src/lib/online/`,
   `src/server/`), never tangled into the simulation or the renderer. The
   simulation must never import from network or UI layers.
3. **Never hardcode the number of missions/levels** in copy, code, or SEO —
   the catalog grows continuously. Derive counts from data if a count is ever
   truly needed.
4. **Server coordinates, client simulates.** No server-side cluster
   simulation. Fairness comes from deterministic replay verification, not
   server authority over gameplay.
5. **Offline-first, always.** Multiplayer features degrade gracefully:
   no network = campaign + local challenge mode still work.
6. **Keep costs boring.** Prefer Firestore listeners and scheduled functions
   over websocket fleets; presence via Realtime Database; leaderboards as
   aggregated documents, not N-player fan-out queries.

---

## 4. The plan — four steps, shipped one at a time

### Step 1 — The Challenge Engine (offline foundation)

*Goal: turn "hand-written levels" into "a machine that generates surprise
incidents" — while everything still runs locally.*

- Refactor level definitions into a general **scenario model**: a scenario =
  base cluster template + parameterized **fault modules** (bad image tag,
  selector typo, node failure, capacity crunch, missing ConfigMap key, broken
  probe, bad rollout, …) + objectives + par time, all **generated from a
  seed**. The current campaign becomes a set of *scripted* scenarios on the
  same model — story pages, portraits and events intact (Principle 1).
- Make the engine run **deterministically from a seed** (seeded RNG for pod
  names and timings) and record a **run log**: every command with its tick,
  plus the final score. Add `replay(seed, log) → score` that reproduces
  results exactly — the anti-cheat and replay-sharing foundation, built while
  everything is still simple.
- Ship **Challenge Mode** on the landing page: "Surprise me" — a random-seed
  incident with difficulty tiers (Apprentice / Operator / Incident Commander).
  No login needed. Immediate player value, and it exercises the generator.
- **Done when**: campaign unchanged and passing; a seed always produces the
  identical scenario; replaying any run log reproduces its score exactly.

### Step 2 — Identity, Daily Challenge & Leaderboards (first backend)

*Goal: the first online features — with a daily cadence instead of real-time,
so the backend starts small.*

- Player profiles in Firestore (`kubetopia/{uid}` grows: handle, avatar
  villager, stats, streaks). Handles unique and moderated; progress sync
  already exists.
- Introduce the **API layer** (Cloud Functions or App Hosting route handlers +
  Admin SDK — pick once, document why): issue the **Daily Challenge seed**
  (same seed worldwide per UTC day, unknowable in advance — the Wordle model),
  accept run submissions (seed + command log + claimed score), **verify by
  replaying on the server** (the deterministic engine is plain TypeScript and
  runs in Node — same module, zero duplication), write verified scores to a
  daily leaderboard document.
- Leaderboard UI: daily top ranks, personal best, streak calendar, shareable
  result cards ("I stabilized Kubetopia in 4:32 🟩🟩🟨").
- **Done when**: two players on different machines get the same daily
  scenario; a tampered score is rejected by replay verification; leaderboard
  reads cost O(1) documents.

### Step 3 — The Living City (presence + simultaneous city events)

*Goal: the "everyone gets hit at the same time" moment — the heart of the
multiplayer vision.*

- **Presence**: signed-in players appear in the 3D town as villagers with
  name tags (Realtime Database presence + throttled position/emote updates).
  The town finally feels inhabited — Habbo/Club Penguin energy, not full MMO
  netcode.
- **City-wide incidents**: a scheduler (Cloud Scheduler → function) publishes
  an event document — "⚡ Storm hits the city in 60 seconds" — every online
  client receives it via a Firestore listener, stages the warning theatrically
  (sirens, the sky darkens for everyone at once), then starts the **same
  seeded scenario simultaneously**. Each player fixes *their own copy* of the
  city's cluster; ranking = verified score + in-simulation time. Live event
  leaderboard as results stream in; podium ceremony in the plaza afterward.
- **Personal surprise challenges**: while idling in the city, players receive
  randomized incidents from the Step 1 generator — per-player seeds, shuffled
  order, fresh fault combinations — so no two players can anticipate or share
  a walkthrough.
- Season points aggregate daily-challenge and city-event results.
- **Done when**: two browsers side-by-side receive a city event within ~2s of
  each other and play the identical scenario; disconnecting mid-event degrades
  to a normal local run.

### Step 4 — The Archipelago (new places, co-op & seasons)

*Goal: room to grow forever — new places, team play, long-term goals.*

- **New districts/islands** beyond the cobblestone city, each with themed
  scenario pools and a visual identity: the Harbor (ingress & traffic storms),
  the Observatory (monitoring & probes), the Frozen Datacenter (node failures
  & capacity), the Bazaar (rollouts & config). Travel by airship from the
  gateway. Districts gate by demonstrated skill, not grind.
- **Co-op incidents** (stretch): two players share one simulated cluster —
  command logs interleaved through a lightweight relay; the engine's
  determinism makes shared state feasible without a heavy game server.
- **Seasons, badges & certification tracks**: achievements aligned with
  CKA/CKAD domains and deep KubeQuest cross-links ("you struggled with probes
  — here's that section of your study plan"), seasonal cosmetics for the
  player's villager, spectating/sharing of top leaderboard replays.
- **Done when**: adding a new district requires only new content modules
  (scenarios + scenery) — no engine or backend changes.

---

## 5. Data model sketch (Firestore, evolves per step)

```
kubetopia/{uid}                     # profile + campaign progress (exists today)
kubetopia_runs/{runId}              # seed, uid, commandLog, score, verified
kubetopia_daily/{yyyy-mm-dd}        # daily seed (released 00:00 UTC), fault mix
kubetopia_daily/{date}/board/{uid}  # verified daily scores (leaderboard)
kubetopia_events/{eventId}          # city incident: startsAt, seed, status
kubetopia_events/{id}/board/{uid}   # per-event verified results
kubetopia_seasons/{seasonId}/…      # aggregated season standings
presence (RTDB): /city/{uid}        # position, emote, lastSeen (ephemeral)
```

Security rules follow the existing pattern: players write only their own
documents; leaderboard writes go **only through the API** (verified runs);
everything else is read-only to clients.

## 6. Risks & open questions

- **Replay verification cost** — replaying a run server-side is cheap (the sim
  is tiny), but rate-limit submissions; verify top-N fully and spot-check the
  rest if volume grows.
- **Clock fairness** — rank city events on *in-simulation ticks used*, never
  wall-clock, so slow devices and browser tab-throttling don't decide winners.
- **Content pipeline** — surprise challenges stay surprising only with a deep
  fault-module pool; budget ongoing content work alongside platform work.
- **Moderation** — handles (and any future chat) need a report path; prefer
  emotes-only social features for as long as possible.
- **Firebase quotas** — presence fan-out and event listeners are the main cost
  drivers; load-test Step 3 with synthetic clients before launch.

---

## 7. UI shell notes (July 2026 — landing & campaign pages redesign)

Shipped alongside the CKAD Hospital Campaign; recorded here because the new
shell was deliberately shaped to absorb the steps above.

- **The landing page is now "The Gateway"** — a dark, game-styled path-select
  screen: hero → "Choose your path" portals → roadmap teasers → KubeQuest
  guild sign. It no longer lists individual missions; each campaign lives at
  `/campaign/{slug}` with its own themed hero, mission grid and metadata.
- **Everything is driven by `TRACKS` data** (`src/lib/levels/index.ts`,
  `TrackInfo`): a portal card and a campaign page exist because a track entry
  exists. **Step 4's districts (Harbor, Observatory, Frozen Datacenter,
  Bazaar) should ship as new `TRACKS` entries** — no new page code. When a
  district needs its own visual identity beyond accent colors, extend
  `TrackInfo`, don't fork the page.
- **The roadmap strip on the landing page mirrors Steps 1–4** (Challenge
  Mode, Daily Challenge, Living City, Archipelago). When a step ships,
  replace its teaser card with a real portal/entry in the same grid — the
  slot is already reserved visually. Challenge Mode (Step 1) should become a
  third portal ("Path of the Storm-Chaser"?) rather than a buried menu item.
- **Per-track progress on portals** comes from the same `Progress` model
  (stars/bestScores keyed by level id) — leaderboard/streak chips from Step 2
  can join the portal footer without layout changes.
- **The game console is now user-resizable** (draggable divider, width
  persisted in `localStorage` under `kubetopia-sidebar-w`). Any future
  replay/spectate view should reuse this splitter rather than invent
  another layout.
- **The no-login guarantee is untouched**: the Gateway, campaign pages and
  every mission remain fully playable signed-out (Principle 1).

---

*This document is the source of truth for Kubetopia's direction. Update it as
steps ship — and keep the campaign sacred.*
