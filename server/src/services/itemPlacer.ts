import seedrandom from 'seedrandom';
import { type MazeGrid, NORTH, SOUTH, EAST, WEST } from './mazeGenerator.js';

export interface ItemType {
  id: string;
  name: string;
  category: 'weapon' | 'armor' | 'potion' | 'treasure';
  stat_effect: Record<string, unknown>;
}

export interface ItemPlacement {
  itemTypeId: string;
  position: string;  // "row,col"
}

function passableCells(grid: MazeGrid): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < grid.height; r++) {
    for (let c = 0; c < grid.width; c++) {
      // A cell is passable if it has at least one open passage
      if (grid.cells[r][c] & (NORTH | SOUTH | EAST | WEST)) {
        cells.push([r, c]);
      }
    }
  }
  return cells;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function placeItems(
  grid: MazeGrid,
  seed: string,
  itemTypes: ItemType[],
  count: number,
): ItemPlacement[] {
  if (!itemTypes.length) return [];
  const rng = seedrandom(`items:${seed}`);
  const available = shuffle(passableCells(grid), rng);

  // Ensure at least one item per category
  const categories = ['weapon', 'armor', 'potion', 'treasure'] as const;
  const placements: ItemPlacement[] = [];
  const usedPositions = new Set<string>();

  // First pass: guarantee one per category
  for (const cat of categories) {
    const typed = itemTypes.filter((it) => it.category === cat);
    if (!typed.length) continue;
    const item = typed[Math.floor(rng() * typed.length)];

    let placed = false;
    for (const [r, c] of available) {
      const pos = `${r},${c}`;
      if (!usedPositions.has(pos)) {
        usedPositions.add(pos);
        placements.push({ itemTypeId: item.id, position: pos });
        placed = true;
        break;
      }
    }
    if (!placed) break; // maze too small — skip remaining
  }

  // Second pass: fill remaining slots
  for (const [r, c] of available) {
    if (placements.length >= count) break;
    const pos = `${r},${c}`;
    if (usedPositions.has(pos)) continue;
    const item = itemTypes[Math.floor(rng() * itemTypes.length)];
    usedPositions.add(pos);
    placements.push({ itemTypeId: item.id, position: pos });
  }

  return placements;
}
