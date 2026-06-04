-- AUTH-05: Token denylist — persists across service restarts (RISK-010)
CREATE TABLE IF NOT EXISTS denylisted_token (
    jti        TEXT        PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_denylist_expires
    ON denylisted_token (expires_at);
