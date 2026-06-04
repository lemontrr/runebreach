import { render, screen } from '@testing-library/react';
import MazeRenderer from './MazeRenderer';

// 5×5 grid where every cell has all 4 passages open (bitmask 15)
const OPEN_GRID = JSON.stringify({ w: 5, h: 5, c: Array.from({ length: 5 }, () => new Array(5).fill(15)) });

describe('MazeRenderer', () => {
  it('renders an SVG with the correct viewBox', () => {
    const { container } = render(
      <MazeRenderer mazeLayout={OPEN_GRID} playerPosition="0,0" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 120 120'); // 5*24 x 5*24
  });

  it('renders an accessible role=img on the SVG', () => {
    render(<MazeRenderer mazeLayout={OPEN_GRID} playerPosition="0,0" />);
    expect(screen.getByRole('img', { name: /dungeon maze/i })).toBeInTheDocument();
  });

  it('renders a role=alert for invalid JSON layout', () => {
    render(<MazeRenderer mazeLayout="{invalid}" playerPosition="0,0" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders one rect per cell (width × height)', () => {
    const { container } = render(
      <MazeRenderer mazeLayout={OPEN_GRID} playerPosition="0,0" />,
    );
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(25); // 5×5
  });

  it('passes items and monsters without crashing', () => {
    const items = [{ position: '1,1', collected: false, name: 'Sword', category: 'weapon' }];
    const monsters = [{ position: '2,2', defeated: false, name: 'Goblin' }];
    const { container } = render(
      <MazeRenderer
        mazeLayout={OPEN_GRID}
        playerPosition="0,0"
        items={items}
        monsters={monsters}
      />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
