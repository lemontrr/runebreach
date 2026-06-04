-- Indexes and constraints applied after tables are created

-- One active session per player (authoritative guard against race condition — RISK-003)
CREATE UNIQUE INDEX IF NOT EXISTS uq_player_active_session
    ON game_session (player_id)
    WHERE (state = 'active');

-- Efficient lookup of sessions by player
CREATE INDEX IF NOT EXISTS idx_game_session_player
    ON game_session (player_id, state);

-- Efficient WebAuthn credential lookup
CREATE INDEX IF NOT EXISTS idx_player_credential_player
    ON player_credential (player_id);

-- Efficient item/monster lookup per session
CREATE INDEX IF NOT EXISTS idx_item_placement_session
    ON item_placement (game_session_id);

CREATE INDEX IF NOT EXISTS idx_monster_placement_session
    ON monster_placement (game_session_id);

-- Auto-update updated_at on game_session
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_game_session_updated_at ON game_session;
CREATE TRIGGER trg_game_session_updated_at
    BEFORE UPDATE ON game_session
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
