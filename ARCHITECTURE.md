# Runebreach — Architecture

## Architecture

### Boundaries

```
Browser (ReactJS SPA)
  └── REST API calls ──► Node.js API Server
                              ├── Auth service (Passkey / WebAuthn)
                              ├── Session service (new game, state updates)
                              ├── Maze generator (server-side, seeded RNG)
                              └── Relational DB (Azure SQL / PostgreSQL — TO BE DECIDED)
```

### Components

**Client (ReactJS SPA)**
- Pre-game: Passkey registration/login, class selection UI
- In-game: maze renderer, player HUD (HP, class, inventory), combat/interaction interface
- Communicates exclusively through REST; holds no authoritative game state

**Node.js API Server**
- Stateless per-request; game state lives in DB
- `POST /sessions` — initializes a new game: generates maze, places items and monsters, persists state; session creation is atomic — DB unique constraint on `(player_id, state=active)` is the authoritative guard against concurrent duplicate sessions
- Session and maze management endpoints (navigate, interact, combat) — `TO BE DECIDED` based on turn model
- Passkey (WebAuthn) endpoints for registration and assertion

**Maze Generator**
- Runs server-side at session creation
- Seeded RNG guarantees unique layouts per session and prevents client manipulation; this guarantee holds regardless of traversal algorithm chosen
- Traversal algorithm `TO BE DECIDED` (constraint: must produce fully traversable mazes with variable branching)

**Catalog (data layer)**
- `PlayerClass` (1:N) `ClassAbility` — class definitions, base stats (HP, Attack, Defense, Speed), abilities
- `ItemType` — item categories (weapon, armor, potion, treasure), stat effects
- `MonsterType` — monster stats and behavior flags
- Extending the game with new classes/monsters/items = new catalog rows, no code changes
- Catalog tables are **read-only at application runtime**; enforced by a least-privilege DB role (no INSERT/UPDATE/DELETE on catalog tables for the app user)

**Auth Service**
- Passkey (WebAuthn) only — no passwords stored
- Short-lived server-issued JWT per game session; player identity persisted across sessions
- Player identity table holds credential IDs, not PII beyond a display name
- GDPR: data minimization by design; right-to-erasure supportable via player record deletion

### Assumptions

- Single-player only (no multiplayer)
- One active `GameSession` per player at a time
- Maze layout stored as serialized data (not re-generated on each request)
- All game state is server-authoritative; client is a display/input layer only

### Deferred Decisions

- Combat mechanics (turn-based vs. real-time)
- Win and loss conditions
- Whether sessions persist across browser close / resume
- Monster AI / behavior model (patrol, aggro range, etc.)
- Maze algorithm (recursive backtracker, Prim's, etc.)

---

## Requirement Traceability

| Requirement | Architecture Coverage | Status |
|---|---|---|
| Req 1 — Procedural maze, unique per session | Server-side maze generator with seeded RNG; seed stored in `GameSession` | Covered |
| Req 2 — Random item placement at game start | Session init populates `ItemPlacement` from `ItemType` catalog | Covered |
| Req 3 — Monster placement; defeat or avoid to progress | Session init populates `MonsterPlacement`; combat/avoidance logic in session service | Covered — combat model `TO BE DECIDED` |
| Req 4 — Class selection with distinct stats and abilities | `PlayerClass` + `ClassAbility` catalog; loaded at session start | Covered |
| Req 5 — Win / loss condition | Not yet defined — see REQUIREMENTS.md §5 | `TO BE DECIDED` |
