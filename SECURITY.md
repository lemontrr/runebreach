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

### Authentication and Authorization

- Passkey (WebAuthn) only — no passwords, no password-reset flows, no magic links
- Every protected endpoint validates session token before any processing
- JWT validation: assert explicit algorithm; reject `alg: none`; validate `iss`, `aud`, `exp`, `nbf`
- Token denylist: support early invalidation on logout and on player account deletion
- Game session endpoints: assert `token.player_id === GameSession.player_id` on every request — no cross-player access
- No game state accepted from client; client sends actions only; server computes outcomes

### Input Validation (Node.js API)

- Validate all request body fields: type, length, range, format; reject unknown fields
- Allowlist valid action/move values; reject anything not on the list with `400`
- All database queries use parameterized statements — no string concatenation with user input
- Maze seed never derived from or exposed to client-controlled input
- Log all input validation failures as potential attack signals

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

### Deployment and CI/CD

- Azure Bicep templates: no hardcoded secrets; all secrets referenced from Azure Key Vault
- Management and admin endpoints: not exposed to the public internet; restrict to Azure VNET or private subnet
- Separate environments for dev, staging, and prod; prod secrets must not be accessible in lower environments
- CI pipeline: secret scanning enabled on every PR (GitHub Advanced Security or equivalent)
