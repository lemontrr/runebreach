import { render, screen } from '@testing-library/react';
import PlayerHUD from './PlayerHUD';
import type { PlayerClass } from './PlayerHUD';

const MAGE: PlayerClass = {
  name: 'Mage',
  base_hp: 100,
  base_attack: 10,
  base_defense: 5,
  base_speed: 8,
};

describe('PlayerHUD', () => {
  it('renders nothing when playerClass is null', () => {
    const { container } = render(
      <PlayerHUD playerClass={null} currentHp={0} collectedItems={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders class name', () => {
    render(<PlayerHUD playerClass={MAGE} currentHp={80} collectedItems={[]} />);
    expect(screen.getByText('Mage')).toBeInTheDocument();
  });

  it('renders HP as "currentHp / maxHp HP"', () => {
    render(<PlayerHUD playerClass={MAGE} currentHp={70} collectedItems={[]} />);
    expect(screen.getByText('70 / 100 HP')).toBeInTheDocument();
  });

  it('renders a meter with correct aria attributes', () => {
    render(<PlayerHUD playerClass={MAGE} currentHp={60} collectedItems={[]} />);
    const meter = screen.getByRole('meter', { name: /hp/i });
    expect(meter).toHaveAttribute('aria-valuenow', '60');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
  });

  it('renders collected items in the inventory section', () => {
    const items = [
      { name: 'Iron Sword', category: 'weapon' },
      { name: 'Health Potion', category: 'potion' },
    ];
    render(<PlayerHUD playerClass={MAGE} currentHp={100} collectedItems={items} />);
    expect(screen.getByText('Iron Sword')).toBeInTheDocument();
    expect(screen.getByText('Health Potion')).toBeInTheDocument();
  });

  it('does not render inventory section when no items collected', () => {
    render(<PlayerHUD playerClass={MAGE} currentHp={100} collectedItems={[]} />);
    expect(screen.queryByRole('region', { name: /inventory/i })).toBeNull();
  });
});
