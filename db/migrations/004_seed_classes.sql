-- CAT-01: Seed PlayerClass catalog
-- TODO: TBD — replace placeholder stats (10) with final values once class design is approved

INSERT INTO player_class (name, base_hp, base_attack, base_defense, base_speed)
VALUES
    ('Mage',    10, 10, 10, 10),
    ('Warrior', 10, 10, 10, 10),
    ('Archer',  10, 10, 10, 10)
ON CONFLICT (name) DO NOTHING;

-- Stub abilities — TODO: TBD — ability mechanics not yet defined (REQUIREMENTS.md §4)
INSERT INTO class_ability (player_class_id, name, description)
SELECT pc.id, 'TBD', 'Ability pending design'
FROM player_class pc
WHERE pc.name IN ('Mage', 'Warrior', 'Archer')
ON CONFLICT DO NOTHING;
