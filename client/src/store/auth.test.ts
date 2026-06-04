import { authStore } from './auth';

describe('authStore', () => {
  afterEach(() => authStore.clearToken());

  it('isAuthenticated returns false with no token', () => {
    expect(authStore.isAuthenticated()).toBe(false);
  });

  it('isAuthenticated returns true after setToken with future expiry', () => {
    const exp = new Date(Date.now() + 60_000);
    authStore.setToken('test-token', exp);
    expect(authStore.isAuthenticated()).toBe(true);
    expect(authStore.getToken()).toBe('test-token');
  });

  it('getToken returns null after expiry', () => {
    const exp = new Date(Date.now() - 1);
    authStore.setToken('expired', exp);
    expect(authStore.getToken()).toBeNull();
    expect(authStore.isAuthenticated()).toBe(false);
  });

  it('clearToken removes the token', () => {
    authStore.setToken('tok', new Date(Date.now() + 60_000));
    authStore.clearToken();
    expect(authStore.isAuthenticated()).toBe(false);
  });
});
