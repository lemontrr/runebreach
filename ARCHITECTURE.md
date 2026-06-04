# Runebreach — Architecture

## Required Architecture Inputs

- **Requirements source:** REQUIREMENTS.md
- **System purpose:** A web-based dungeon game in which a player selects a class, navigates a procedurally generated maze, collects items, and defeats or avoids monsters. Each session produces a unique maze layout.
- **Primary use cases:**
  1. Player authenticates (register / login via Passkey)
  2. Player selects a class and starts a new game session
  3. Server generates maze and places items and monsters
  4. Player navigates the maze, encounters monsters, and collects items
  5. Session ends on win or loss condition (`TO BE DECIDED`)
- **Target users / actors:** Human player (single-player assumed); Game server as authoritative state engine
- **Runtime environment:** Web application
- **Server framework:** Node.js
- **Client framework:** ReactJS
- **API style and integration model:** REST
- **Authentication and session model:** No auth requirement in REQUIREMENTS.md. Given GDPR sensitivity, Passkey (WebAuthn) is appropriate — passwordless and phishing-resistant. Active game state gated by a short-lived server-issued session token per game session. Player identity persisted across sessions.
- **Data model expectations:** Relational, 3rd Normal Form. Core entities: `Player`, `PlayerClass`, `ClassAbility`, `GameSession`, `ItemType`, `ItemPlacement`, `MonsterType`, `MonsterPlacement`. Catalog tables (`ItemType`, `MonsterType`, `PlayerClass`) are static and extensible by data addition only.
- **Deployment model:** Azure (Bicep templates)
- **Scale expectations:** Expansion potential for new player classes, monsters, and items via catalog data — no code changes required for new entries
- **Security expectations:** Significant — GDPR-governed player data. Passkey auth eliminates password storage. PII minimized at the data model level.

---

## Initial Architecture (Provisional)

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
- `POST /sessions` — initializes a new game: generates maze, places items and monsters, persists state
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

**Auth Service**
- Passkey (WebAuthn) only — no passwords stored
- Player identity table holds credential IDs, not PII beyond a display name
- GDPR: data minimization by design; right-to-erasure supportable via player record deletion

### Assumptions

- Single-player only (no multiplayer)
- One active `GameSession` per player at a time
- Maze layout stored as serialized data (not re-generated on each request)
- All game state is server-authoritative; client is a display/input layer only

### Knowns Unknown

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
| Auth and player identity | Passkey (WebAuthn); `Player` table with credential ID | Covered — no auth requirement in REQUIREMENTS.md, driven by GDPR |
| Win / loss condition | Not defined in REQUIREMENTS.md | `TO BE DECIDED` |
| Combat mechanics | Not defined in REQUIREMENTS.md | `TO BE DECIDED` |
| Monster behavior / AI | Not defined in REQUIREMENTS.md | `TO BE DECIDED` |
| Session persistence (resume after disconnect) | Not defined in REQUIREMENTS.md | `TO BE DECIDED` |
| Multiplayer scope | Not defined in REQUIREMENTS.md; assumed single-player | `TO BE DECIDED` |
