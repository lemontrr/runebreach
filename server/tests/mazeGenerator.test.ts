import {
  generateMaze,
  serializeMaze,
  deserializeMaze,
  isFullyTraversable,
} from '../src/services/mazeGenerator';

describe('mazeGenerator', () => {
  it('produces deterministic output for the same seed', () => {
    const a = generateMaze('seed-abc', 10, 10);
    const b = generateMaze('seed-abc', 10, 10);
    expect(a.cells).toEqual(b.cells);
  });

  it('produces different layouts for different seeds', () => {
    const a = generateMaze('seed-1', 10, 10);
    const b = generateMaze('seed-2', 10, 10);
    expect(a.cells).not.toEqual(b.cells);
  });

  it('all cells are reachable from (0,0) — BFS traversability', () => {
    for (let i = 0; i < 10; i++) {
      const grid = generateMaze(`seed-${i}`, 15, 15);
      expect(isFullyTraversable(grid)).toBe(true);
    }
  });

  it('respects the requested dimensions', () => {
    const grid = generateMaze('seed-dim', 7, 5);
    expect(grid.width).toBe(7);
    expect(grid.height).toBe(5);
    expect(grid.cells.length).toBe(5);
    expect(grid.cells[0].length).toBe(7);
  });

  it('round-trips through serialize/deserialize', () => {
    const grid = generateMaze('seed-rt', 8, 8);
    const restored = deserializeMaze(serializeMaze(grid));
    expect(restored.cells).toEqual(grid.cells);
    expect(restored.width).toBe(grid.width);
    expect(restored.height).toBe(grid.height);
  });

  it('is fully traversable after deserialization', () => {
    const grid = generateMaze('seed-td', 12, 12);
    const restored = deserializeMaze(serializeMaze(grid));
    expect(isFullyTraversable(restored)).toBe(true);
  });
});
