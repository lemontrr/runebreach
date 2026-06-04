import type { CSSProperties } from 'react';

// Passage bitmasks — must match server/src/services/mazeGenerator.ts
const NORTH = 1;
const SOUTH = 2;
const EAST  = 4;
const WEST  = 8;

export interface MazeLayout {
  w: number;
  h: number;
  c: number[][];   // cells[row][col] bitmask
}

export interface ItemOnMap {
  position: string;  // "row,col"
  collected: boolean;
  name: string;
  category: string;
}

export interface MonsterOnMap {
  position: string;
  defeated: boolean;
  name: string;
}

interface Props {
  mazeLayout: string;        // serialized JSON from server
  playerPosition: string;    // "row,col"
  items?: ItemOnMap[];
  monsters?: MonsterOnMap[];
}

const CELL_PX = 24;
const WALL_PX = 2;

function posKey(row: number, col: number) {
  return `${row},${col}`;
}

function CellView({
  row,
  col,
  bits,
  isPlayer,
  item,
  monster,
}: {
  row: number;
  col: number;
  bits: number;
  isPlayer: boolean;
  item?: ItemOnMap;
  monster?: MonsterOnMap;
}) {
  const x = col * CELL_PX;
  const y = row * CELL_PX;

  const walls: { x1: number; y1: number; x2: number; y2: number }[] = [];
  if (!(bits & NORTH)) walls.push({ x1: x, y1: y, x2: x + CELL_PX, y2: y });
  if (!(bits & SOUTH)) walls.push({ x1: x, y1: y + CELL_PX, x2: x + CELL_PX, y2: y + CELL_PX });
  if (!(bits & WEST))  walls.push({ x1: x, y1: y, x2: x, y2: y + CELL_PX });
  if (!(bits & EAST))  walls.push({ x1: x + CELL_PX, y1: y, x2: x + CELL_PX, y2: y + CELL_PX });

  let fill = '#1a1a2e';
  if (isPlayer) fill = '#4fc3f7';
  else if (monster && !monster.defeated) fill = '#ef5350';
  else if (item && !item.collected) fill = '#ffd54f';

  return (
    <>
      <rect x={x} y={y} width={CELL_PX} height={CELL_PX} fill={fill} />
      {walls.map((w, i) => (
        <line
          key={i}
          x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
          stroke="#546e7a"
          strokeWidth={WALL_PX}
          strokeLinecap="square"
        />
      ))}
    </>
  );
}

// UI-04: SVG maze renderer. No dangerouslySetInnerHTML — all output via React elements.
export default function MazeRenderer({
  mazeLayout,
  playerPosition,
  items = [],
  monsters = [],
}: Props) {
  let grid: MazeLayout;
  try {
    grid = JSON.parse(mazeLayout) as MazeLayout;
  } catch {
    return <p role="alert">Invalid maze data.</p>;
  }

  const itemMap = new Map(items.map((it) => [it.position, it]));
  const monsterMap = new Map(monsters.map((m) => [m.position, m]));

  const svgWidth  = grid.w * CELL_PX;
  const svgHeight = grid.h * CELL_PX;

  const style: CSSProperties = { display: 'block', maxWidth: '100%', height: 'auto' };

  return (
    <svg
      role="img"
      aria-label="Dungeon maze"
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      style={style}
    >
      {grid.c.map((row, r) =>
        row.map((bits, c) => (
          <CellView
            key={posKey(r, c)}
            row={r}
            col={c}
            bits={bits}
            isPlayer={playerPosition === posKey(r, c)}
            item={itemMap.get(posKey(r, c))}
            monster={monsterMap.get(posKey(r, c))}
          />
        ))
      )}
    </svg>
  );
}
