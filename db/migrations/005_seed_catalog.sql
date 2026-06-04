-- CAT-02: Seed ItemType and MonsterType catalogs
-- TODO: TBD — replace placeholder stats with final values from game design

INSERT INTO item_type (name, category, stat_effect)
VALUES
    ('Iron Sword',    'weapon',   '{"attack": 5}'),
    ('Leather Armor', 'armor',    '{"defense": 3}'),
    ('Health Potion', 'potion',   '{"hp": 20}'),
    ('Gold Coin',     'treasure', '{}')
ON CONFLICT (name) DO NOTHING;

-- TODO: TBD — behavior_flags schema defined with monster AI design
INSERT INTO monster_type (name, hp, attack, defense, speed, behavior_flags)
VALUES
    ('Goblin',   10, 3,  1,  5, '{}'),
    ('Skeleton', 15, 5,  3,  3, '{}'),
    ('Dragon',   50, 15, 10, 2, '{}')
ON CONFLICT (name) DO NOTHING;
