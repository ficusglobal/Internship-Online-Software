// Keeps a signed-in session across page reloads. The JWT lives in localStorage (`authToken`);
// this record adds the role and display name, and the token's expiry so an old token is not reused.

export type SessionRole = "student" | "cyber-cafe" | "admin";

export interface StoredSession {
  role: SessionRole;
  name: string;
  expiresAt: number; // epoch ms, from the token's `exp` claim
}

const SESSION_KEY = "authSession";
const TOKEN_KEY = "authToken";

// Reads the `exp` claim of a JWT (no signature check; the backend validates every request)
export function tokenExpiry(token: string): number {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage can be blocked (private mode); the user then signs in again after a reload
  }
}

// Returns the saved session only while its token is still valid
export function loadSession(): StoredSession | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(SESSION_KEY);
    if (!token || !raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    if (!session.expiresAt || session.expiresAt <= Date.now()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("userId");
  } catch {
    // Nothing to clear if storage is unavailable
  }
}
