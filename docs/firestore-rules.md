# Firestore security rules — Kubetopia campaign tracking & leaderboards

> ⚠️ **The Firebase project `kubequest-dd648` is shared with KubeQuest.** There
> is exactly one `firestore.rules` per project. **Do not deploy a rules file
> from this repo standalone** — it would overwrite KubeQuest's rules. Instead,
> **merge the `match` blocks below** into the project's existing ruleset
> (managed alongside KubeQuest) and deploy from there.

These rules back the collections introduced with campaign auth-gating:

- `kubetopia/{uid}` — profile + campaign progress (already in use).
- `kubetopia_campaign_runs/{uid}/runs/{runId}` — a player's own run history.
- `kubetopia_leaderboards/{boardId}/entries/{uid}` — public campaign standings.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- Kubetopia cloud save (existing) --------------------------------
    match /kubetopia/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // --- Campaign run history: private to its owner ---------------------
    // Runs are append-only from the client; nobody else can read them.
    match /kubetopia_campaign_runs/{uid}/runs/{runId} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null && request.auth.uid == uid;
      allow update, delete: if false;
    }

    // --- Campaign leaderboards: world-readable, self-writable ----------
    // The board is public to everyone (signed in or not). Each player may
    // only write their own entry, and the entry's uid must match them.
    //
    // NOTE: campaign scores are client-attested for now. The competitive
    // online modes (Challenge / Daily / City events) will route writes
    // through a verified server path before their scores count — at which
    // point those boards move to `allow write: if false` for clients.
    match /kubetopia_leaderboards/{boardId}/entries/{uid} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.uid == uid
                   && request.resource.data.uid == uid;
    }
    match /kubetopia_leaderboards/{boardId} {
      allow read: if true;
      allow write: if false; // board metadata is not client-managed
    }
  }
}
```

## Why these shapes

- **Run history is a per-user subcollection** (`{uid}/runs/...`) so ownership is
  expressed by the path — one rule guards the whole subtree, and a scalable
  write pattern (append a document) needs no fan-out.
- **Leaderboard entries are one aggregate document per player per board**, so a
  public board renders with a single bounded `orderBy(...).limit(N)` query —
  O(N) reads for the top N, never O(players).
- **Denormalised `displayName`/`photoURL`** on each entry means the board never
  has to read `kubetopia/{uid}` per row.
