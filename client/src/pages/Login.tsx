import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/types';
import { api, ApiError } from '../api/client.js';
import { authStore } from '../store/auth.js';

type LoginState = 'idle' | 'loading' | 'error';

interface AuthFinishResponse {
  token: string;
  expiresAt: string;
}

export default function Login() {
  const navigate = useNavigate();
  const [playerId, setPlayerId] = useState('');
  const [state, setState] = useState<LoginState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!browserSupportsWebAuthn()) {
    return (
      <main>
        <h1>Sign in unavailable</h1>
        <p>Your browser does not support Passkeys. Please use a modern browser.</p>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    setErrorMsg('');

    try {
      const options = await api.post<PublicKeyCredentialRequestOptionsJSON>(
        '/auth/authenticate/begin',
        { playerId },
      );

      let assertion;
      try {
        assertion = await startAuthentication({ optionsJSON: options });
      } catch {
        setState('error');
        setErrorMsg('Authentication was cancelled or failed. Please try again.');
        return;
      }

      const { token, expiresAt } = await api.post<AuthFinishResponse>(
        '/auth/authenticate/finish',
        { playerId, response: assertion },
      );

      // Store token in memory only — never localStorage/sessionStorage (SECURITY.md)
      authStore.setToken(token, new Date(expiresAt));
      navigate('/select-class');
    } catch {
      setState('error');
      setErrorMsg('Sign in failed. Please check your Player ID and try again.');
    }
  }

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } finally {
      authStore.clearToken();
      navigate('/login');
    }
  }

  return (
    <main>
      <h1>Sign In</h1>
      {state === 'error' && <p role="alert">{errorMsg}</p>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="playerId">Player ID</label>
        <input
          id="playerId"
          type="text"
          value={playerId}
          required
          pattern="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          onChange={(e) => setPlayerId(e.target.value)}
          disabled={state === 'loading'}
        />
        <button type="submit" disabled={state === 'loading'}>
          {state === 'loading' ? 'Signing in…' : 'Sign in with Passkey'}
        </button>
      </form>
      <p>
        No account? <Link to="/register">Create one</Link>
      </p>
    </main>
  );
}
