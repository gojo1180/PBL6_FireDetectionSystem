// JWT Token helpers — stored in localStorage
const TOKEN_KEY = "sentinel_jwt_token";
const USER_KEY = "sentinel_user";

export interface AuthUser {
  email: string;
  user_id: string;
  full_name?: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;

  // Basic JWT expiry check (decode payload without verification)
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function getUser(): AuthUser | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      email: payload.sub,
      user_id: payload.user_id,
      full_name: payload.full_name,
    };
  } catch {
    return null;
  }
}
