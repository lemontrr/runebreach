import { placeMonsters } from '../src/services/monsterPlacer';
import { placeItems } from '../src/services/itemPlacer';
import { generateMaze } from '../src/services/mazeGenerator';
import type { MonsterType } from '../src/services/monsterPlacer';
import type { ItemType } from '../src/services/itemPlacer';

const SEED = 'monster-seed';
const GRID = generateMaze(SEED, 15, 15);
const ITEMS: ItemType[] = [
  { id: 'w1', name: 'Sword', category: 'weapon',   stat_effect: {} },
  { id: 'a1', name: 'Armor', category: 'armor',    stat_effect: {} },
  { id: 'p1', name: 'Potion',category: 'potion',   stat_effect: {} },
  { id: 't1', name: 'Coin',  category: 'treasure', stat_effect: {} },
];
const MONSTERS: MonsterType[] = [
  { id: 'm1', name: 'Goblin',  hp: 10, attack: 3, defense: 1, speed: 5, behavior_flags: {} },
  { id: 'm2', name: 'Skeleton',hp: 15, attack: 5, defense: 3, speed: 3, behavior_flags: {} },
];

describe('placeMonsters()', () => {
  function getItemPositions() {
    return new Set(placeItems(GRID, SEED, ITEMS, 6).map((p) => p.position));
  }

  it('is deterministic for the same seed', () => {
    const excluded = getItemPositions();
    const a = placeMonsters(GRID, SEED, excluded, MONSTERS, 4);
    const b = placeMonsters(GRID, SEED, excluded, MONSTERS, 4);
    expect(a).toEqual(b);
  });

  it('no monster shares a cell with an item', () => {
    const excluded = getItemPositions();
    const placements = placeMonsters(GRID, SEED, excluded, MONSTERS, 4);
    for (const p of placements) {
      expect(excluded.has(p.position)).toBe(false);
    }
  });

  it('no monster is placed at the start cell (0,0)', () => {
    const excluded = getItemPositions();
    const placements = placeMonsters(GRID, SEED, excluded, MONSTERS, 4);
    expect(placements.map((p) => p.position)).not.toContain('0,0');
  });

  it('no two monsters share the same cell', () => {
    const excluded = getItemPositions();
    const placements = placeMonsters(GRID, SEED, excluded, MONSTERS, 4);
    const positions = placements.map((p) => p.position);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('respects the count parameter', () => {
    const excluded = getItemPositions();
    const placements = placeMonsters(GRID, SEED, excluded, MONSTERS, 3);
    expect(placements.length).toBeLessThanOrEqual(3);
  });
});
