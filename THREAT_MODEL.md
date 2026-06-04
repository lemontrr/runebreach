# Runebreach — Threat Model

**Method**: STRIDE per data flow, with attack trees for highest-risk scenarios.
**Date**: 2026-06-04 | **Status**: Bootstrap — no implementation yet; findings target the design.

---

## 1. System Overview

Runebreach is a server-authoritative web game. The client is a pure display/input layer; all state lives in the database. The server generates the maze, places items and monsters, and validates every player action. No game state is trusted from the client.

---

## 2. Assets and Security Goals

| Asset | Classification | Confidentiality | Integrity | Availability |
|---|---|---|---|---|
| Player display name | PII (GDPR) | High | Medium | Low |
| WebAuthn credential (public key, credential ID) | Auth material | Medium¹ | Critical | High |
| JWT signing key | Secret | Critical | Critical | High |
| WebAuthn RP secret | Secret | Critical | Critical | High |
| DB credentials | Secret | Critical | Critical | High |
| Active JWT tokens | Session | High | Critical | High |
| Game session state | Internal | Low | High | Medium |
| Maze seed | Internal | Medium² | High | Low |

> ¹ Credential IDs are not secret (WebAuthn design), but public keys must not be tampered with.
> ² Seed confidentiality prevents layout prediction; it does not need to be encrypted, only kept server-side.

---

## 3. Trust Boundaries and Data Flow

### Context Diagram

```mermaid
flowchart TB
    subgraph UNTRUSTED["Untrusted Zone"]
        Browser["Browser\n(ReactJS SPA)"]
        Attacker["Threat Actor"]
    end

    subgraph TLS_EDGE["TLS Termination Boundary"]
        HTTPS["HTTPS / TLS 1.2+\nHSTS preloaded"]
    end

    subgraph AZURE_VNET["Azure VNET  —  Trusted Private Network"]
        subgraph API_SERVER["Node.js API Server  (stateless)"]
            AuthSvc["Auth Service\nWebAuthn + JWT"]
            SessionSvc["Session Service\nPOST /sessions\nGET /sessions/:id"]
            MazeGen["Maze Generator\nSeeded RNG"]
            InputVal["Input Validation\nZod middleware"]
            ErrHandler["Error Handler\nno internal detail to client"]
        end
        DB[("Relational DB\nAzure SQL / PostgreSQL")]
        KV["Azure Key Vault\nJWT key · DB creds · RP secret"]
    end

    subgraph CICD["CI/CD  —  Partially Trusted"]
        GHA["GitHub Actions"]
        SecScan["Secret Scanner\nGHAS / TruffleHog"]
    end

    Browser -- "REST API calls" --> HTTPS
    Attacker -. "attack surface" .-> HTTPS
    HTTPS --> API_SERVER
    API_SERVER --> DB
    API_SERVER -- "Managed Identity" --> KV
    GHA -- "deploy artifacts" --> AZURE_VNET
    SecScan -- "scans" --> GHA

    style UNTRUSTED fill:#ffcccc,stroke:#cc0000
    style TLS_EDGE fill:#ffe0b2,stroke:#e65100
    style AZURE_VNET fill:#c8e6c9,stroke:#2e7d32
    style CICD fill:#e3f2fd,stroke:#1565c0
```

### Internal Data Flows

| ID | Flow | Trust Boundary Crossed |
|---|---|---|
| DF-1 | Browser → `POST /auth/register/begin` + `/finish` | Internet → API |
| DF-2 | Browser → `POST /auth/authenticate/begin` + `/finish` | Internet → API |
| DF-3 | Browser → `POST /sessions` | Internet → API (authenticated) |
| DF-4 | Browser → `GET /sessions/{id}` | Internet → API (authenticated) |
| DF-5 | API → Database (all queries) | API → Private DB |
| DF-6 | API → Azure Key Vault | API → Secrets store |
| DF-7 | GitHub Actions → Azure | CI/CD → Production |

---

## 4. Threat Actor Profiles

| Actor | Capability | Motivation |
|---|---|---|
| Unauthenticated attacker | Can send arbitrary HTTP requests | Account takeover, data theft, DoS |
| Authenticated player | Valid session token, own game state | Cross-player access, game state manipulation, cheating |
| Malicious insider | Code/repo access, CI/CD access | Supply chain injection, secret exfiltration |
| Compromised dependency | Code execution within Node.js process | Credential theft, data exfiltration |

---

## 5. Authentication Flow

```mermaid
sequenceDiagram
    actor Player
    participant Browser
    participant API
    participant DB
    participant KV as Key Vault

    Note over Player,KV: Registration
    Player->>Browser: Enter display name
    Browser->>API: POST /auth/register/begin {displayName}
    API->>DB: INSERT Player(display_name)
    API-->>Browser: PublicKeyCredentialCreationOptions + challenge
    Browser->>Player: Browser prompts for authenticator
    Player->>Browser: Touch authenticator
    Browser->>API: POST /auth/register/finish {credential}
    API->>API: Verify credential against challenge (server-side)
    API->>DB: INSERT PlayerCredential(credential_id, public_key, sign_count)
    API-->>Browser: 200 registered

    Note over Player,KV: Authentication
    Browser->>API: POST /auth/authenticate/begin {playerId}
    API->>DB: SELECT PlayerCredential WHERE player_id=?
    API-->>Browser: PublicKeyCredentialRequestOptions + challenge
    Browser->>Player: Browser prompts for authenticator
    Player->>Browser: Touch authenticator
    Browser->>API: POST /auth/authenticate/finish {assertion}
    API->>API: Verify assertion signature + RPID + sign_count
    API->>DB: UPDATE PlayerCredential SET sign_count=?
    API->>KV: GET jwt_signing_key
    API->>API: Issue JWT(sub=playerId, jti=uuid, exp=+15m)
    API-->>Browser: {token, expiresAt}
```

---

## 6. STRIDE Analysis

### DF-1 / DF-2 — Registration and Authentication Endpoints

| # | Threat | STRIDE | Severity | Status | Finding |
|---|---|---|---|---|---|
| T-01 | Attacker floods `/register` or `/auth/begin` to exhaust DB connections or cause DoS | D | High | **Mitigated** | Stricter rate limiting on auth endpoints |
| T-02 | Replay attack: reuse a captured WebAuthn challenge | S | High | **Mitigated** | Challenges are single-use and short-lived |
| T-03 | Cloned authenticator: replay assertion with stale sign_count | S | High | **Mitigated** | sign_count must exceed stored value |
| T-04 | **Account enumeration**: `/authenticate/begin` returns a different response for unknown `playerId` vs. known, allowing ID harvesting | I | High | **GAP** → RISK-001 | Consistent response required regardless of player existence |
| T-05 | Challenge injection: attacker supplies their own challenge | T | Critical | **Mitigated** | Challenge is server-generated; client cannot influence it |
| T-06 | RPID spoofing: attacker hosts a phishing site and registers/asserts against a different origin | S | High | **GAP** → RISK-002 | RPID binding must be explicitly validated per SECURITY.md |
| T-07 | Registration with a chosen display name matching another player | S | Low | Accepted | Display name is not a security credential; player_id is the identity |
| T-08 | Missing timing side channel on registration response | I | Low | Accepted | No meaningful timing oracle in this flow |

### DF-3 — `POST /sessions` (Session Initialization)

| # | Threat | STRIDE | Severity | Status | Finding |
|---|---|---|---|---|---|
| T-09 | **Race condition**: two concurrent requests both pass the "one active session" API check before either inserts, creating two active sessions | T | High | **GAP** → RISK-003 | Atomic check-and-insert; DB unique constraint is the guard; constraint violation must map to 409 not 500 |
| T-10 | Supplying a `classId` not in the catalog to probe DB errors | I | Medium | **Mitigated** | Zod validation + parameterized query; catalog lookup before insert |
| T-11 | Game session never expires — resource exhaustion and stale token risk | D/E | Medium | **GAP** → RISK-004 | No session inactivity timeout defined |
| T-12 | Client-controlled maze properties via crafted body fields | T | High | **Mitigated** | Zod strict schema; unknown fields rejected; maze seed server-generated |

### DF-4 — `GET /sessions/{id}` and Future Game Action Endpoints

| # | Threat | STRIDE | Severity | Status | Finding |
|---|---|---|---|---|---|
| T-13 | Cross-player access: request another player's session ID | E | Critical | **Mitigated** | `token.player_id === GameSession.player_id` check on every request |
| T-14 | IDOR via session ID enumeration (sequential or predictable IDs) | I | High | **Mitigated** | Session IDs must be UUIDs (unguessable); DB validates ownership |
| T-15 | Client sends game action values not on the allowlist | T | High | **Mitigated** | Zod allowlist on action/move values; reject with 400 |
| T-16 | Missing CSRF protection | T | — | **N/A — document** → RISK-005 | Bearer token in Authorization header; CSRF not applicable for REST + Bearer. Document explicitly to prevent future implementation error. |

### DF-5 — API → Database

| # | Threat | STRIDE | Severity | Status | Finding |
|---|---|---|---|---|---|
| T-17 | SQL injection via user-supplied input | T | Critical | **Mitigated** | Parameterized statements required |
| T-18 | Over-privileged DB user modifies catalog tables at runtime | E | High | **GAP** → RISK-006 | Application DB role must be read-only on catalog tables; no DDL rights |
| T-19 | DB connection without TLS allows sniffing on internal network | I | Medium | **GAP** → RISK-007 | DB connections must enforce SSL; certificate validation enabled |
| T-20 | Slow-query or connection-pool exhaustion attack | D | Medium | **GAP** → RISK-008 | Query timeouts and connection pool max-size must be configured |
| T-21 | Mass data extraction via unparameterized batch operation | I | High | **Mitigated** | Parameterized queries + row-level ownership checks |

### DF-6 — API → Azure Key Vault

| # | Threat | STRIDE | Severity | Status | Finding |
|---|---|---|---|---|---|
| T-22 | Managed identity granted excessive Azure RBAC permissions | E | High | **GAP** → RISK-009 | Least-privilege managed identity: Key Vault Secrets User role only |
| T-23 | JWT signing key not rotated; compromised key used indefinitely | S | High | **GAP** (TBD) | Rotation schedule TBD per SECURITY.md; must be defined before production |
| T-24 | JWT denylist stored in-memory only; restart reactivates revoked tokens | S | Critical | **GAP** → RISK-010 | Denylist must persist across restarts (Redis with AOF/RDB or DB table) |

### DF-7 — CI/CD Pipeline

| # | Threat | STRIDE | Severity | Status | Finding |
|---|---|---|---|---|---|
| T-25 | Unpinned GitHub Actions version compromised by tag mutation | T | High | **GAP** → RISK-011 | Pin all Actions to specific commit SHA |
| T-26 | Secrets echoed in CI workflow logs | I | High | **GAP** → RISK-012 | Explicit secret masking required for all env secrets in workflow logs |
| T-27 | Malicious or vulnerable transitive dependency | T | High | **GAP** → RISK-013 | `package-lock.json` must be committed; dependency review Action on every PR |
| T-28 | Compromised PR merges malicious code that passes secret scan | T | Medium | Accepted (residual) | Mitigated by GHAS + human review; residual risk acknowledged |

---

## 7. Attack Trees

### Attack Tree 1: Compromise a Player Account

```mermaid
flowchart TB
    ROOT["🎯 Compromise Player Account\n(obtain valid JWT as victim)"]

    ROOT --> A["A: Steal JWT token"]
    ROOT --> B["B: Bypass WebAuthn assertion"]
    ROOT --> C["C: Forge JWT token"]

    A --> A1["A1: XSS — steal in-memory token\nLikelihood: Low\nControl: CSP + React escaping"]
    A --> A2["A2: MitM — intercept token in transit\nLikelihood: Low\nControl: HTTPS + HSTS"]
    A --> A3["A3: Exploit denylist restart gap\nLikelihood: Medium if in-memory only\n⚠️ RISK-010"]

    B --> B1["B1: Phish victim to attacker-controlled origin\nLikelihood: Low\nControl: RPID binding\n⚠️ RISK-002 if not validated"]
    B --> B2["B2: Clone authenticator (replay old sign_count)\nLikelihood: Very Low\nControl: sign_count enforcement"]
    B --> B3["B3: Enumerate valid playerIds, then spam /begin\nLikelihood: Medium\n⚠️ RISK-001 (enumeration)"]

    C --> C1["C1: Obtain JWT signing key from Key Vault\nLikelihood: Very Low\nControl: Managed Identity + RBAC"]
    C --> C2["C2: Algorithm confusion (alg:none or HS/RS swap)\nLikelihood: Low\nControl: Explicit alg assertion"]
    C --> C3["C3: Exploit signing key after restart with revoked token\nLikelihood: Medium if denylist in-memory\n⚠️ RISK-010"]

    style ROOT fill:#cc0000,color:#fff
    style A3 fill:#ffaaaa
    style B1 fill:#ffaaaa
    style B3 fill:#ffaaaa
    style C3 fill:#ffaaaa
```

### Attack Tree 2: Tamper with Game State

```mermaid
flowchart TB
    ROOT2["🎯 Tamper with Game State\n(illegitimate game outcome or advantage)"]

    ROOT2 --> D["D: Send crafted actions from client"]
    ROOT2 --> E["E: Exploit session initialization"]
    ROOT2 --> F["F: Directly modify DB"]

    D --> D1["D1: Send action value not on allowlist\nLikelihood: Low\nControl: Zod allowlist, 400 reject"]
    D --> D2["D2: Send unknown fields to probe/inject state\nLikelihood: Low\nControl: Zod strict() — unknown fields rejected"]
    D --> D3["D3: Access another player's session\nLikelihood: Low\nControl: player_id claim check on every request"]

    E --> E1["E1: Race condition — create two active sessions\nLikelihood: Medium under load\n⚠️ RISK-003"]
    E --> E2["E2: Supply invalid classId to trigger error disclosure\nLikelihood: Low\nControl: Generic error responses + Zod"]
    E --> E3["E3: Inject client-controlled maze seed\nLikelihood: Low\nControl: Seed always server-generated"]

    F --> F1["F1: SQL injection via user input\nLikelihood: Low\nControl: Parameterized queries"]
    F --> F2["F2: Exploit over-privileged DB user to UPDATE catalog\nLikelihood: Medium if not least-privileged\n⚠️ RISK-006"]
    F --> F3["F3: Compromise DB credentials\nLikelihood: Very Low\nControl: Key Vault + private endpoint"]

    style ROOT2 fill:#cc0000,color:#fff
    style E1 fill:#ffaaaa
    style F2 fill:#ffaaaa
```

### Attack Tree 3: Exfiltrate Player PII (GDPR Breach)

```mermaid
flowchart TB
    ROOT3["🎯 Exfiltrate Player PII\n(display_name + credential IDs)"]

    ROOT3 --> G["G: Extract via API responses"]
    ROOT3 --> H["H: Extract via logs or telemetry"]
    ROOT3 --> I["I: Extract from DB directly"]

    G --> G1["G1: Error response leaks display_name or field names\nLikelihood: Low\nControl: Generic error handler"]
    G --> G2["G2: Cross-player session read returns another player's data\nLikelihood: Low\nControl: player_id ownership check"]
    G --> G3["G3: Bulk enumeration via /auth/authenticate/begin\nLikelihood: Medium\n⚠️ RISK-001 — consistent response required"]

    H --> H1["H1: display_name written to application logs\nLikelihood: Medium without explicit control\nControl: PII sanitization in logger"]
    H --> H2["H2: Token value written to logs\nLikelihood: Medium without explicit control\nControl: Token sanitization in logger"]
    H --> H3["H3: Secrets echoed in CI/CD logs\nLikelihood: Medium\n⚠️ RISK-012"]

    I --> I1["I1: SQL injection — bulk SELECT\nLikelihood: Low\nControl: Parameterized queries"]
    I --> I2["I2: Compromised DB credentials → direct access\nLikelihood: Very Low\nControl: Key Vault + private endpoint"]
    I --> I3["I3: No data retention → old PII accumulates indefinitely\nLikelihood: Certain without policy\n⚠️ TBD — retention policy required before production"]

    style ROOT3 fill:#cc0000,color:#fff
    style G3 fill:#ffaaaa
    style H3 fill:#ffaaaa
    style I3 fill:#ffaaaa
```

---

## 8. Risk Register

| ID | Threat | Component | Severity | Likelihood | Risk | Action |
|---|---|---|---|---|---|---|
| RISK-001 | Account enumeration via `/auth/authenticate/begin` | Auth | High | Medium | **High** | Fix in SECURITY.md |
| RISK-002 | RPID binding not explicit in security spec | Auth | High | Low | **Medium** | Fix in SECURITY.md |
| RISK-003 | Race condition on session creation — two active sessions | Session | High | Medium | **High** | Fix in SECURITY.md + ARCHITECTURE.md |
| RISK-004 | Game session never expires | Session | Medium | High | **High** | Fix in SECURITY.md |
| RISK-005 | CSRF scope undocumented | API | Low | High | **Medium** | Document in SECURITY.md |
| RISK-006 | DB application user can write to catalog tables | DB | High | Medium | **High** | Fix in SECURITY.md |
| RISK-007 | DB connection without TLS | DB | Medium | Medium | **Medium** | Fix in SECURITY.md |
| RISK-008 | No query timeout or connection pool limit | DB | Medium | Medium | **Medium** | Fix in SECURITY.md |
| RISK-009 | Over-privileged managed identity | Infra | High | Low | **Medium** | Fix in SECURITY.md |
| RISK-010 | JWT denylist in-memory only — survives restart gap | Auth | Critical | Medium | **Critical** | Fix in SECURITY.md |
| RISK-011 | Unpinned GitHub Actions versions | CI/CD | High | Medium | **High** | Fix in SECURITY.md |
| RISK-012 | Secrets echoed in CI/CD logs | CI/CD | High | Medium | **High** | Fix in SECURITY.md |
| RISK-013 | No `package-lock.json` / dependency review | CI/CD | High | Medium | **High** | Fix in SECURITY.md |
| RISK-014 | Incomplete Content-Security-Policy | Client | High | High | **High** | Fix in SECURITY.md |
| RISK-015 | Server fingerprinting via version headers | API | Low | High | **Medium** | Fix in SECURITY.md |

---

## 9. Residual / Accepted Risks

| Risk | Rationale |
|---|---|
| Phishing (non-origin-bound) | WebAuthn RPID binding makes phishing cryptographically impossible |
| Brute-force password attack | No passwords exist in this system |
| Session fixation | JWT is issued fresh on every authentication; no reuse |
| Credential stuffing | Passkey eliminates shared secrets |

---

## 10. Open Risks (Blocked on TBD Decisions)

These risks cannot be fully mitigated until the corresponding TBD items are resolved:

| Risk | Blocked On |
|---|---|
| Session timeout cannot be set | Win/loss conditions TBD — unclear when a session legitimately ends |
| Data retention policy | GDPR lawful basis and retention period TBD |
| JWT rotation schedule | Key rotation TBD |
| Combat action allowlist | Combat mechanics TBD |
