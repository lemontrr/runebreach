-- Runtime tables: populated and mutated during gameplay

CREATE TABLE IF NOT EXISTS player (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- display_name is PII (GDPR) — never log, never return in errors
    display_name VARCHAR(64) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WebAuthn credentials — one player may have multiple authenticators
CREATE TABLE IF NOT EXISTS player_credential (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id     UUID        NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    credential_id TEXT        NOT NULL,
    public_key    BYTEA       NOT NULL,
    sign_count    BIGINT      NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_credential_id UNIQUE (credential_id)
);

CREATE TABLE IF NOT EXISTS game_session (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID        NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    player_class_id UUID        NOT NULL REFERENCES player_class(id),
    -- maze_seed is server-generated and NEVER returned to the client
    maze_seed       TEXT        NOT NULL,
    maze_layout     TEXT        NOT NULL,
    state           VARCHAR(16) NOT NULL DEFAULT 'active'
                    CHECK (state IN ('active','won','lost','abandoned')),
    -- TODO: TBD - won/lost transitions blocked on win/loss condition design
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_placement (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    game_session_id UUID    NOT NULL REFERENCES game_session(id) ON DELETE CASCADE,
    item_type_id    UUID    NOT NULL REFERENCES item_type(id),
    position        TEXT    NOT NULL,
    collected       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS monster_placement (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    game_session_id UUID    NOT NULL REFERENCES game_session(id) ON DELETE CASCADE,
    monster_type_id UUID    NOT NULL REFERENCES monster_type(id),
    position        TEXT    NOT NULL,
    defeated        BOOLEAN NOT NULL DEFAULT FALSE
);
