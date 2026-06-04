import seedrandom from 'seedrandom';
import { type MazeGrid, NORTH, SOUTH, EAST, WEST } from './mazeGenerator.js';

export interface MonsterType {
  id: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  behavior_flags: Record<string, unknown>;
}

export interface MonsterPlacement {
  monsterTypeId: string;
  position: string;  // "row,col"
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function placeMonsters(
  grid: MazeGrid,
  seed: string,
  excludedPositions: Set<string>,
  monsterTypes: MonsterType[],
  count: number,
): MonsterPlacement[] {
  const rng = seedrandom(`monsters:${seed}`);

  const available: [number, number][] = [];
  for (let r = 0; r < grid.height; r++) {
    for (let c = 0; c < grid.width; c++) {
      const pos = `${r},${c}`;
      // Must have an open passage, must not overlap items, must not be start cell (0,0)
      if (
        grid.cells[r][c] & (NORTH | SOUTH | EAST | WEST) &&
        !excludedPositions.has(pos) &&
        !(r === 0 && c === 0)
      ) {
        available.push([r, c]);
      }
    }
  }

  const shuffled = shuffle(available, rng);
  const placements: MonsterPlacement[] = [];
  const usedPositions = new Set<string>(excludedPositions);

  for (const [r, c] of shuffled) {
    if (placements.length >= count) break;
    const pos = `${r},${c}`;
    if (usedPositions.has(pos)) continue;
    const monster = monsterTypes[Math.floor(rng() * monsterTypes.length)];
    usedPositions.add(pos);
    placements.push({ monsterTypeId: monster.id, position: pos });
  }

  return placements;
}
