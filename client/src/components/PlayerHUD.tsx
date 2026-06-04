// UI-05: Player HUD — shows HP, class, collected items. No PII displayed.
export interface PlayerClass {
  name: string;
  base_hp: number;
  base_attack: number;
  base_defense: number;
  base_speed: number;
}

export interface CollectedItem {
  name: string;
  category: string;
}

interface Props {
  playerClass: PlayerClass | null;
  currentHp: number;
  collectedItems: CollectedItem[];
}

export default function PlayerHUD({ playerClass, currentHp, collectedItems }: Props) {
  if (!playerClass) return null;

  const maxHp = playerClass.base_hp;
  const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));

  return (
    <aside aria-label="Player status">
      <h2>{playerClass.name}</h2>
      <div role="meter" aria-label="HP" aria-valuenow={currentHp} aria-valuemin={0} aria-valuemax={maxHp}>
        <span>{currentHp} / {maxHp} HP</span>
        <div style={{ background: '#333', borderRadius: 4, height: 12, width: '100%', marginTop: 4 }}>
          <div
            style={{
              background: hpPct > 50 ? '#4caf50' : hpPct > 25 ? '#ff9800' : '#f44336',
              width: `${hpPct}%`,
              height: '100%',
              borderRadius: 4,
              transition: 'width 0.3s',
            }}
          />
        </div>
      </div>
      <dl>
        <dt>Attack</dt><dd>{playerClass.base_attack}</dd>
        <dt>Defense</dt><dd>{playerClass.base_defense}</dd>
        <dt>Speed</dt><dd>{playerClass.base_speed}</dd>
      </dl>
      {collectedItems.length > 0 && (
        <section aria-label="Inventory">
          <h3>Inventory</h3>
          <ul>
            {collectedItems.map((item, i) => (
              <li key={i}>{item.name} <span>({item.category})</span></li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
