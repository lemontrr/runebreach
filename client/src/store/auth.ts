// In-memory token store — token is NEVER written to localStorage or sessionStorage (CSRF/XSS)
let token: string | null = null;
let expiresAt: Date | null = null;

export const authStore = {
  setToken(t: string, exp: Date): void {
    token = t;
    expiresAt = exp;
  },
  getToken(): string | null {
    if (!token || !expiresAt) return null;
    if (expiresAt <= new Date()) {
      token = null;
      expiresAt = null;
      return null;
    }
    return token;
  },
  clearToken(): void {
    token = null;
    expiresAt = null;
  },
  isAuthenticated(): boolean {
    return this.getToken() !== null;
  },
};
