import seedrandom from 'seedrandom';

// Bitmask for passage directions
export const NORTH = 1;
export const SOUTH = 2;
export const EAST  = 4;
export const WEST  = 8;

export interface MazeGrid {
  width: number;
  height: number;
  cells: number[][];  // cells[row][col] — bitmask of open passages
}

const DIRS = [
  { bit: NORTH, dr: -1, dc:  0, opposite: SOUTH },
  { bit: SOUTH, dr:  1, dc:  0, opposite: NORTH },
  { bit: EAST,  dr:  0, dc:  1, opposite: WEST  },
  { bit: WEST,  dr:  0, dc: -1, opposite: EAST  },
];

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Recursive backtracker — guarantees all cells reachable from (0,0)
function carve(
  grid: number[][],
  row: number,
  col: number,
  visited: boolean[][],
  rng: () => number,
): void {
  visited[row][col] = true;
  const dirs = shuffle(DIRS, rng);
  for (const { bit, dr, dc, opposite } of dirs) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length && !visited[nr][nc]) {
      grid[row][col] |= bit;
      grid[nr][nc] |= opposite;
      carve(grid, nr, nc, visited, rng);
    }
  }
}

export function generateMaze(seed: string, width: number, height: number): MazeGrid {
  const rng = seedrandom(seed);
  const cells: number[][] = Array.from({ length: height }, () => new Array(width).fill(0));
  const visited: boolean[][] = Array.from({ length: height }, () => new Array(width).fill(false));
  carve(cells, 0, 0, visited, rng);
  return { width, height, cells };
}

export function serializeMaze(grid: MazeGrid): string {
  return JSON.stringify({ w: grid.width, h: grid.height, c: grid.cells });
}

export function deserializeMaze(data: string): MazeGrid {
  const { w, h, c } = JSON.parse(data) as { w: number; h: number; c: number[][] };
  return { width: w, height: h, cells: c };
}

// BFS traversability check — all cells reachable from (0,0)
export function isFullyTraversable(grid: MazeGrid): boolean {
  const visited = new Set<string>();
  const queue: [number, number][] = [[0, 0]];
  visited.add('0,0');

  while (queue.length) {
    const [row, col] = queue.shift()!;
    const cell = grid.cells[row][col];

    for (const { bit, dr, dc } of DIRS) {
      if (cell & bit) {
        const nr = row + dr;
        const nc = col + dc;
        const key = `${nr},${nc}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push([nr, nc]);
        }
      }
    }
  }

  return visited.size === grid.width * grid.height;
}
