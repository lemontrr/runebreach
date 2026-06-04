import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  startRegistration,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import { api } from '../api/client.js';

type RegistrationState = 'idle' | 'loading' | 'success' | 'error';

interface BeginResponse {
  playerId: string;
  options: Parameters<typeof startRegistration>[0];
}

export default function Register() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [state, setState] = useState<RegistrationState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!browserSupportsWebAuthn()) {
    return (
      <main>
        <h1>Registration unavailable</h1>
        <p>Your browser does not support Passkeys. Please use a modern browser.</p>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    setErrorMsg('');

    try {
      const { playerId, options } = await api.post<BeginResponse>(
        '/auth/register/begin',
        { displayName },
      );

      let credential;
      try {
        credential = await startRegistration(options);
      } catch (err) {
        // User cancelled or authenticator error — generic message, not browser detail
        setState('error');
        setErrorMsg('Registration was cancelled or failed. Please try again.');
        return;
      }

      await api.post('/auth/register/finish', { playerId, response: credential });
      setState('success');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setState('error');
      // Never surface server error details
      setErrorMsg('Registration failed. Please try again.');
    }
  }

  return (
    <main>
      <h1>Create Account</h1>
      {state === 'success' && <p role="status">Account created! Redirecting to login…</p>}
      {state === 'error' && <p role="alert">{errorMsg}</p>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="displayName">Display name</label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          maxLength={64}
          required
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={state === 'loading' || state === 'success'}
        />
        <button type="submit" disabled={state === 'loading' || state === 'success'}>
          {state === 'loading' ? 'Registering…' : 'Register with Passkey'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </main>
  );
}
