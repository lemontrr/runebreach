import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';
import { config } from '../config.js';

// In-memory challenge store — keyed by playerId
// In production, replace with a short-TTL cache (Redis) — this is sufficient for bootstrap
const pendingChallenges = new Map<string, string>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

// Clean up expired challenges periodically
setInterval(() => {
  pendingChallenges.clear();
}, CHALLENGE_TTL_MS);

export async function beginRegistration(
  playerId: string,
  displayName: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const options = await generateRegistrationOptions({
    rpID: config.webauthn.rpId,
    rpName: config.webauthn.rpName,
    userName: playerId,
    userDisplayName: displayName,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    supportedAlgorithmIDs: [-7, -257], // ES256, RS256
  });

  // Store challenge keyed by playerId — single-use, cleared on finish
  pendingChallenges.set(`reg:${playerId}`, options.challenge);
  return options;
}

export async function finishRegistration(
  playerId: string,
  response: RegistrationResponseJSON,
): Promise<VerifiedRegistrationResponse> {
  const expectedChallenge = pendingChallenges.get(`reg:${playerId}`);
  if (!expectedChallenge) throw new Error('No pending challenge');

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.webauthn.origin,
    expectedRPID: config.webauthn.rpId,  // RPID binding assertion (RISK-002)
    requireUserVerification: false,
  });

  // Challenge consumed — remove to prevent replay
  pendingChallenges.delete(`reg:${playerId}`);
  return verification;
}

export async function beginAuthentication(
  playerId: string,
  credentialIds: string[],
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const options = await generateAuthenticationOptions({
    rpID: config.webauthn.rpId,
    allowCredentials: credentialIds.map((id) => ({ id, type: 'public-key' })),
    userVerification: 'preferred',
  });

  pendingChallenges.set(`auth:${playerId}`, options.challenge);
  return options;
}

export async function finishAuthentication(
  playerId: string,
  response: AuthenticationResponseJSON,
  credentialId: string,
  publicKey: Uint8Array,
  currentSignCount: number,
): Promise<VerifiedAuthenticationResponse> {
  const expectedChallenge = pendingChallenges.get(`auth:${playerId}`);
  if (!expectedChallenge) throw new Error('No pending challenge');

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.webauthn.origin,
    expectedRPID: config.webauthn.rpId,  // RPID binding assertion (RISK-002)
    credential: {
      id: credentialId,
      publicKey,
      counter: currentSignCount,
    },
    requireUserVerification: false,
  });

  pendingChallenges.delete(`auth:${playerId}`);
  return verification;
}
