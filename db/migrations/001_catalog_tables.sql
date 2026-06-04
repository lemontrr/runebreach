-- Catalog tables: read-only at application runtime
-- Extended by adding rows only; no code changes needed for new entries

CREATE TABLE IF NOT EXISTS player_class (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(64)  NOT NULL UNIQUE,
    -- TODO: TBD - replace placeholder stats (10) with real values once decided
    base_hp      INT NOT NULL DEFAULT 10 CHECK (base_hp > 0),
    base_attack  INT NOT NULL DEFAULT 10 CHECK (base_attack > 0),
    base_defense INT NOT NULL DEFAULT 10 CHECK (base_defense > 0),
    base_speed   INT NOT NULL DEFAULT 10 CHECK (base_speed > 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_ability (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_class_id UUID NOT NULL REFERENCES player_class(id) ON DELETE CASCADE,
    -- TODO: TBD - ability mechanics not yet defined (REQUIREMENTS.md §4)
    name            VARCHAR(128) NOT NULL,
    description     TEXT         NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_type (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(128) NOT NULL UNIQUE,
    category    VARCHAR(32)  NOT NULL CHECK (category IN ('weapon','armor','potion','treasure')),
    -- TODO: TBD - stat effect schema to be defined with combat mechanics
    stat_effect JSONB        NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monster_type (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(128) NOT NULL UNIQUE,
    -- TODO: TBD - replace placeholder stats (10) with real values once decided
    hp             INT  NOT NULL DEFAULT 10 CHECK (hp > 0),
    attack         INT  NOT NULL DEFAULT 5  CHECK (attack > 0),
    defense        INT  NOT NULL DEFAULT 3  CHECK (defense >= 0),
    speed          INT  NOT NULL DEFAULT 3  CHECK (speed > 0),
    -- TODO: TBD - behavior_flags schema to be defined with monster AI design
    behavior_flags JSONB NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
