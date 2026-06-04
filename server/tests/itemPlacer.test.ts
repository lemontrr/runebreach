import { placeItems } from '../src/services/itemPlacer';
import { generateMaze } from '../src/services/mazeGenerator';
import type { ItemType } from '../src/services/itemPlacer';

const SEED = 'test-seed';
const GRID = generateMaze(SEED, 15, 15);
const ITEMS: ItemType[] = [
  { id: 'w1', name: 'Sword', category: 'weapon',   stat_effect: {} },
  { id: 'a1', name: 'Armor', category: 'armor',    stat_effect: {} },
  { id: 'p1', name: 'Potion',category: 'potion',   stat_effect: {} },
  { id: 't1', name: 'Coin',  category: 'treasure', stat_effect: {} },
];

describe('placeItems()', () => {
  it('is deterministic for the same seed', () => {
    const a = placeItems(GRID, SEED, ITEMS, 8);
    const b = placeItems(GRID, SEED, ITEMS, 8);
    expect(a).toEqual(b);
  });

  it('produces different results for different seeds', () => {
    const a = placeItems(GRID, 'seed-a', ITEMS, 8);
    const b = placeItems(GRID, 'seed-b', ITEMS, 8);
    expect(a).not.toEqual(b);
  });

  it('no two items share the same position', () => {
    const placements = placeItems(GRID, SEED, ITEMS, 8);
    const positions = placements.map((p) => p.position);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('places at least one item per category when possible', () => {
    const placements = placeItems(GRID, SEED, ITEMS, 8);
    const placedItemIds = new Set(placements.map((p) => p.itemTypeId));
    // At least one of each category
    expect(placedItemIds.has('w1')).toBe(true);
    expect(placedItemIds.has('a1')).toBe(true);
    expect(placedItemIds.has('p1')).toBe(true);
    expect(placedItemIds.has('t1')).toBe(true);
  });

  it('respects the count parameter', () => {
    const placements = placeItems(GRID, SEED, ITEMS, 6);
    expect(placements.length).toBeLessThanOrEqual(6);
  });
});
