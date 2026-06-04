# CLAUDE.md — Runebreach

@REQUIREMENTS.md
@ARCHITECTURE.md
@Security.md

## Project Snapshot
Bootstrap phase — specs defined, no implementation yet. Web-based procedural dungeon game.

| Layer | Technology |
|---|---|
| Client | ReactJS SPA |
| API | Node.js REST |
| Auth | Passkey (WebAuthn) + short-lived JWT |
| DB | Relational 3NF — Azure SQL or PostgreSQL (TBD) |
| Deploy | Azure (Bicep) |

## Working Rules

### Spec and Scope
- Precedence: `REQUIREMENTS.md` > `ARCHITECTURE.md` > `Security.md`
- Do not implement anything marked `TO BE DECIDED`. Stop and surface it as an open question.
- Do not infer or invent requirements not present in the spec files.
- Server is authoritative for all game state. Client sends actions only; server computes outcomes.

### Code Quality
- Low cyclomatic complexity, low cognitive complexity, separation of concerns.
- No comments that describe *what* the code does — only *why* (non-obvious constraints, invariants, workarounds).
- No half-finished implementations. No backwards-compatibility shims for code that does not exist yet.

### Security Defaults (full rules in Security.md)
- Default posture: **reject-unknown / fail-closed** on every API boundary.
- All DB queries use parameterized statements — no string concatenation with user input.
- `maze_seed` is never returned to the client in any response.
- No PII (`display_name`), token values, or internal error detail in any log or client error response.
- Secrets in environment variables only — never in source code or Bicep templates.

### GitHub Issues
- **Every new GitHub issue MUST use the requirement template** at `.github/ISSUE_TEMPLATE/requirement-web-api.md`.
- Every issue must trace to at least one section in the spec files; include an explicit rationale if it cannot.
- Do not open issues for `TO BE DECIDED` items — resolve the open question first.

## Open Questions (do not implement until resolved)
- [ ] DB vendor: Azure SQL vs PostgreSQL
- [ ] Maze traversal algorithm (constraint: fully traversable, variable branching)
- [ ] Win / loss conditions — REQUIREMENTS.md §5
- [ ] Combat mechanics: turn-based vs real-time
- [ ] Class ability mechanics — REQUIREMENTS.md §4
- [ ] Monster AI / behavior model
- [ ] Session resume after browser close
- [ ] JWT signing key rotation schedule — Security.md §Secret Handling
- [ ] GDPR data retention policy and lawful basis — Security.md §GDPR
- [ ] Player class base stats (HP, Attack, Defense, Speed per class)
