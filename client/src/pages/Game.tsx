import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import MazeRenderer, { type ItemOnMap, type MonsterOnMap } from '../components/MazeRenderer.js';
import PlayerHUD, { type PlayerClass, type CollectedItem } from '../components/PlayerHUD.js';

interface SessionState {
  sessionId: string;
  state: string;
  mazeLayout: string;
  playerClass: PlayerClass | null;
  itemPlacements: Array<{
    position: string;
    collected: boolean;
    name: string;
    category: string;
  }>;
  monsterPlacements: Array<{
    position: string;
    defeated: boolean;
    name: string;
  }>;
}

// UI-04 + UI-05 host page
export default function Game() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  // Player starts at cell (0,0). Movement is TBD (combat mechanics not yet defined).
  const [playerPosition] = useState('0,0');

  useEffect(() => {
    if (!sessionId || sessionId === 'existing') {
      // 409 redirect placeholder — navigate back to class selection
      navigate('/select-class');
      return;
    }

    api.get<SessionState>(`/sessions/${sessionId}`)
      .then(setSession)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate('/login');
        } else {
          setErrorMsg('Failed to load game session. Please try again.');
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId, navigate]);

  if (loading) return <main><p>Loading game…</p></main>;
  if (errorMsg) return <main><p role="alert">{errorMsg}</p></main>;
  if (!session) return null;

  const items: ItemOnMap[] = session.itemPlacements.map((p) => ({
    position: p.position,
    collected: p.collected,
    name: p.name,
    category: p.category,
  }));

  const monsters: MonsterOnMap[] = session.monsterPlacements.map((p) => ({
    position: p.position,
    defeated: p.defeated,
    name: p.name,
  }));

  const collectedItems: CollectedItem[] = session.itemPlacements
    .filter((p) => p.collected)
    .map((p) => ({ name: p.name, category: p.category }));

  // TODO: TBD - win/loss condition transitions not yet defined (REQUIREMENTS.md §5)
  const currentHp = session.playerClass?.base_hp ?? 0;

  return (
    <main style={{ display: 'flex', gap: 16 }}>
      <section aria-label="Maze">
        <h1>Runebreach</h1>
        {session.state !== 'active' && (
          <p role="status">Session state: {session.state}</p>
        )}
        <MazeRenderer
          mazeLayout={session.mazeLayout}
          playerPosition={playerPosition}
          items={items}
          monsters={monsters}
        />
        <p style={{ fontSize: 12, marginTop: 8 }}>
          Position: {playerPosition}
          {/* TODO: TBD - movement controls blocked on combat mechanics decision */}
        </p>
      </section>
      <PlayerHUD
        playerClass={session.playerClass}
        currentHp={currentHp}
        collectedItems={collectedItems}
      />
    </main>
  );
}
