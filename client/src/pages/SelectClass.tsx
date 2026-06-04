import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';

interface ClassAbility {
  id: string;
  name: string;
  description: string;
}

interface PlayerClass {
  id: string;
  name: string;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  abilities: ClassAbility[];
}

interface SessionResponse {
  sessionId: string;
}

export default function SelectClass() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<PlayerClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    api.get<PlayerClass[]>('/classes')
      .then(setClasses)
      .catch(() => setErrorMsg('Failed to load classes. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSelect(classId: string) {
    setStarting(true);
    setErrorMsg('');
    try {
      const { sessionId } = await api.post<SessionResponse>('/sessions', { classId });
      navigate(`/game/${sessionId}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Active session already exists — the server will tell us the existing session
        // For now navigate to game root and let the game page handle session lookup
        navigate('/game/existing');
      } else {
        setErrorMsg('Failed to start game. Please try again.');
      }
      setStarting(false);
    }
  }

  if (loading) return <main><p>Loading classes…</p></main>;

  return (
    <main>
      <h1>Choose Your Class</h1>
      {errorMsg && <p role="alert">{errorMsg}</p>}
      <ul>
        {classes.map((cls) => (
          <li key={cls.id}>
            <h2>{cls.name}</h2>
            <dl>
              <dt>HP</dt><dd>{cls.baseHp}</dd>
              <dt>Attack</dt><dd>{cls.baseAttack}</dd>
              <dt>Defense</dt><dd>{cls.baseDefense}</dd>
              <dt>Speed</dt><dd>{cls.baseSpeed}</dd>
            </dl>
            {cls.abilities.length > 0 && (
              <ul>
                {cls.abilities.map((ab) => (
                  <li key={ab.id}><strong>{ab.name}</strong>: {ab.description}</li>
                ))}
              </ul>
            )}
            <button
              onClick={() => handleSelect(cls.id)}
              disabled={starting}
              aria-label={`Play as ${cls.name}`}
            >
              {starting ? 'Starting…' : `Play as ${cls.name}`}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
