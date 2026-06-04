# Runebreach — CLAUDE.md

## Project Context
Web-based procedural dungeon game. Stack: ReactJS SPA + Node.js REST API + Relational DB (Azure SQL or PostgreSQL — TBD) + Passkey (WebAuthn) auth + Azure deployment.

Spec precedence: `REQUIREMENTS.md` > `ARCHITECTURE.md` > `SECURITY.md`.

Do not implement anything marked **TO BE DECIDED** in the specs. Collect ambiguity as an open question and stop.

---

## Parallel Execution Plan

Issues in the same wave are fully independent and can be worked simultaneously. Never start a wave until all issues in the previous wave are merged.

### Wave 1 — Foundation (no dependencies; start all in parallel)
| Issue | Title |
|---|---|
| #7 INFRA-01 | Node.js API server scaffold + security middleware |
| #8 INFRA-02 | ReactJS SPA scaffold |
| #9 INFRA-03 | Database schema migrations |
| #10 INFRA-04 | Azure Bicep infrastructure |
| #11 INFRA-05 | CI pipeline + secret scanning |
| #12 OBS-01 | Structured logging module |

### Wave 2 — Core services (unblock after Wave 1 merges)
| Issue | Title | Needs |
|---|---|---|
| #13 INFRA-06 | Input validation middleware (Zod) | INFRA-01, OBS-01 |
| #14 AUTH-01 | WebAuthn registration endpoint | INFRA-01, INFRA-03, OBS-01 |
| #15 AUTH-02 | WebAuthn authentication endpoint | INFRA-01, INFRA-03, OBS-01 |
| #16 AUTH-03 | JWT token issuance | INFRA-01 |
| #17 CAT-01 | Seed PlayerClass catalog | INFRA-03 |
| #18 CAT-02 | Seed ItemType + MonsterType | INFRA-03 |
| #19 MAZE-01 | Seeded RNG maze generator | INFRA-01 |
| #20 OBS-02 | Global error handler | INFRA-01, OBS-01 |

### Wave 3 — Features (unblock after Wave 2 merges)
| Issue | Title | Needs |
|---|---|---|
| #21 AUTH-04 | JWT validation middleware | AUTH-03 |
| #22 AUTH-05 | Token denylist + logout | AUTH-03 |
| #23 AUTH-06 | GDPR right to erasure | AUTH-04, AUTH-05, INFRA-03 |
| #24 CAT-03 | GET /classes endpoint | AUTH-04, INFRA-06, CAT-01 |
| #25 MAZE-02 | Item placement module | MAZE-01, CAT-02 |
| #26 MAZE-03 | Monster placement module | MAZE-01, MAZE-02, CAT-02 |
| #27 UI-01 | Passkey registration UI | INFRA-02, AUTH-01 |
| #28 UI-02 | Passkey login UI | INFRA-02, AUTH-02, AUTH-03 |

### Wave 4 — Session init (unblock after Wave 3 merges)
| Issue | Title | Needs |
|---|---|---|
| #29 SESSION-01 | POST /sessions | AUTH-04, INFRA-06, CAT-01/02, MAZE-01/02/03 |
| #30 UI-03 | Class selection UI | UI-02, CAT-03, SESSION-01 |

### Wave 5 — In-game (unblock after Wave 4 merges)
| Issue | Title | Needs |
|---|---|---|
| #31 SESSION-02 | GET /sessions/{id} | SESSION-01, AUTH-04 |
| #32 UI-04 | Maze renderer | UI-03, SESSION-02 |
| #33 UI-05 | Player HUD | UI-03, SESSION-02 |

---

## Security Defaults
Every PR must pass before merge:
- SAST (ESLint security plugin) — zero new findings
- Secret scan (INFRA-05) — zero findings
- Branch coverage ≥ 80% on changed modules
- TypeScript compile — zero errors

Default posture for all API handlers: **reject-unknown / fail-closed**.
- Unknown request fields → `400`
- Missing or invalid auth → `401`
- Cross-player resource access → `403`
- Denylist store unavailable → reject token, do not pass

## Hard Rules (from SECURITY.md)
- No PII (`display_name`) in any log, error response, or URL
- No token values in logs
- No secrets in source code or Bicep templates — Key Vault only
- `maze_seed` never returned to client
- All DB queries parameterized — no string concatenation with user input
- Token `alg: none` always rejected explicitly
- Client sends actions only; server computes all outcomes

## Open Questions (do not implement until resolved)
- DB vendor: Azure SQL vs PostgreSQL
- Maze traversal algorithm
- Win / loss conditions (REQUIREMENTS.md §5)
- Combat mechanics (turn-based vs real-time)
- Class abilities (REQUIREMENTS.md §4)
- Monster AI / behavior model
- Session resume after browser close
- JWT signing key rotation schedule
- GDPR data retention policy and lawful basis
- Player class base stats (placeholder values used in CAT-01)
