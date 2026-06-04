# Runebreach — Security

## Provisional Security Rules

### HTTP Boundary

- HTTPS only on all endpoints; no HTTP fallback
- HSTS: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- HTTP method allowlist enforced per endpoint; respond `405` on disallowed methods
- `Content-Type: application/json` required on all mutation endpoints; reject with `415` otherwise
- Mandatory response headers on every response:
  - `X-Content-Type-Options: nosniff`
  - `Cache-Control: no-store`
  - `Content-Security-Policy: frame-ancestors 'none'`
  - `X-Frame-Options: DENY`
- CORS: `Access-Control-Allow-Origin` restricted to the deployed SPA origin; no wildcard
- Rate limiting on all endpoints; respond `429` on breach; apply stricter limits to auth and registration endpoints
- Reject oversized request bodies; respond `413` on breach
- Remove `X-Powered-By` and all server version/framework identification headers from every response

### Authentication and Authorization

- Passkey (WebAuthn) only — no passwords, no password-reset flows, no magic links
- WebAuthn: assert RPID on every registration and assertion; reject any response where RPID does not match the server's configured origin (RISK-002)
- Account enumeration prevention: `POST /auth/authenticate/begin` MUST return an identical response — including response time — whether or not the `playerId` exists; use a dummy challenge for unknown IDs (RISK-001)
- Every protected endpoint validates session token before any processing
- JWT validation: assert explicit algorithm; reject `alg: none`; validate `iss`, `aud`, `exp`, `nbf`
- Token denylist MUST persist across service restarts — Redis with AOF/RDB persistence or a DB-backed table; never in-memory only (RISK-010)
- Token denylist: support early invalidation on logout and on player account deletion
- Game session endpoints: assert `token.player_id === GameSession.player_id` on every request — no cross-player access
- No game state accepted from client; client sends actions only; server computes outcomes
- CSRF: this API uses `Authorization: Bearer` headers only — CSRF tokens are not required; tokens MUST NOT be stored in cookies (RISK-005)

### Input Validation (Node.js API)

- Validate all request body fields: type, length, range, format; reject unknown fields
- Allowlist valid action/move values; reject anything not on the list with `400`
- All database queries use parameterized statements — no string concatenation with user input
- Maze seed never derived from or exposed to client-controlled input
- Log all input validation failures as potential attack signals
- `POST /sessions`: session creation must be atomic — handle DB unique-constraint violation on `(player_id, state=active)` as `409 Conflict`, not `500` (RISK-003)
- Active `GameSession` records with no activity for longer than `[TO BE DECIDED — required before production]` MUST be marked `abandoned`; prevents indefinite resource consumption and stale-token risk (RISK-004)

### Secret Handling

- No credentials, tokens, or seeds in URLs or query strings; place in headers or POST body
- All secrets (DB credentials, JWT signing keys, WebAuthn RP secret) in environment variables; never committed to the repo
- Azure Key Vault for production secrets; Bicep templates reference Key Vault — no plaintext values in templates
- JWT signing key rotation supported; rotation schedule `TO BE DECIDED` before production

### Logging and Error Handling

- Client receives generic error messages only — no stack traces, internal paths, SQL errors, or field names
- Structured server-side log fields: `timestamp`, `player_id` (if authenticated), `endpoint`, `http_status`, `error_code`
- Log the following events: auth failures, token validation failures, input validation failures, rate limit hits
- No PII, credential values, or token values written to any log
- Sanitize all log entries to prevent log injection attacks

### GDPR

- Display name is PII: collect only what is necessary; do not expose in logs, error responses, or analytics
- Right to erasure: `DELETE /players/{id}` cascades to all associated records (`GameSession`, `ItemPlacement`, `MonsterPlacement`)
- Data retention policy: `TO BE DECIDED` — must be defined and documented before production launch
- Lawful basis for processing: `TO BE DECIDED`
- No PII in logs, error messages, or any event emitted outside the service boundary

### Database Security

- DB application user: least-privilege role — `INSERT`, `SELECT`, `UPDATE`, `DELETE` on runtime tables only; `SELECT` only on catalog tables (`PlayerClass`, `ClassAbility`, `ItemType`, `MonsterType`); no `DDL` rights (RISK-006)
- DB connections must use SSL/TLS with certificate validation enabled; plaintext connections rejected (RISK-007)
- Query timeout and connection pool maximum size must be configured; slow-query threshold alerting enabled (RISK-008)
- DB private endpoint only — no public IP; DB not reachable from outside the Azure VNET

### Deployment and CI/CD

- Azure Bicep templates: no hardcoded secrets; all secrets referenced from Azure Key Vault
- Azure managed identity for the API server: `Key Vault Secrets User` role only — no broader resource group permissions (RISK-009)
- Management and admin endpoints: not exposed to the public internet; restrict to Azure VNET or private subnet
- Separate environments for dev, staging, and prod; prod secrets must not be accessible in lower environments
- CI pipeline: secret scanning enabled on every PR (GitHub Advanced Security or equivalent)
- All GitHub Actions steps must be pinned to a specific commit SHA, not a mutable version tag (e.g., `actions/checkout@<sha>`) (RISK-011)
- All secrets referenced in GitHub Actions workflows must be masked; never echo or print secret values in workflow logs (RISK-012)
- `package-lock.json` must be committed and kept up to date; dependency review GitHub Action enabled on every PR to flag new high/critical CVEs (RISK-013)

### Client Security

- Content-Security-Policy on all responses from the API and the SPA host: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' <api-origin>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` — substitute `<api-origin>` with the deployed API origin (RISK-014)
- No use of `dangerouslySetInnerHTML` in the React SPA; all data from the API treated as untrusted before rendering
