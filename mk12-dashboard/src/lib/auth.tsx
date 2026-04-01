"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "./types";
import { setAuthToken } from "./api-client";

const TOKEN_KEY = "mk12_token";
import { REFRESH_KEY } from "./api-client";
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role?: string) => Promise<void>;
  devLogin: (email: string, name: string, role?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

// ─── Token helpers ──────────────────────────────────────────────────────────

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) setAuthToken(token); // Sync to api-client in-memory
  return token;
}

function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

function storeTokens(token: string, refreshToken?: string) {
  localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  setAuthToken(token); // Sync to api-client in-memory
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  setAuthToken(null); // Clear api-client in-memory token
}

/** Decode JWT payload to read exp claim (seconds since epoch) */
function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

// ─── Auth API calls ─────────────────────────────────────────────────────────

async function fetchMe(token: string): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Unauthorized");
  const data = await res.json();
  return data.user ?? data;
}

async function postLogin(email: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? body.message ?? "Login failed");
  }
  return res.json() as Promise<{ token: string; refreshToken: string; user: User }>;
}

async function postRegister(email: string, password: string, name: string, role: string) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, role }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? body.message ?? "Registration failed");
  }
  return res.json() as Promise<{ token: string; refreshToken: string; user: User }>;
}

async function postDevToken(email: string, name: string, role: string) {
  const res = await fetch(`${BASE_URL}/api/auth/dev-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, role }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? body.message ?? "Dev token request failed");
  }
  return res.json() as Promise<{ token: string }>;
}

async function postRefresh(refreshToken: string) {
  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error("Refresh failed");
  return res.json() as Promise<{ token: string; refreshToken: string }>;
}

// ─── Provider ───────────────────────────────────────────────────────────────

const PUBLIC_PATHS = ["/login", "/login/register"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schedule a token refresh 60 seconds before expiry
  const scheduleRefresh = useCallback((currentToken: string) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const exp = getTokenExpiry(currentToken);
    if (!exp) return;
    const msUntilExpiry = exp * 1000 - Date.now();
    const refreshIn = Math.max(msUntilExpiry - 60_000, 5_000);
    refreshTimer.current = setTimeout(async () => {
      const rt = getStoredRefreshToken();
      if (!rt) return;
      try {
        const data = await postRefresh(rt);
        storeTokens(data.token, data.refreshToken);
        setToken(data.token);
        scheduleRefresh(data.token);
      } catch {
        // Refresh failed — force logout
        clearTokens();
        setToken(null);
        setUser(null);
        router.push("/login");
      }
    }, refreshIn);
  }, [router]);

  // Bootstrap: check stored token on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = getStoredToken();
      if (!stored) {
        setIsLoading(false);
        if (!PUBLIC_PATHS.includes(pathname)) {
          router.replace("/login");
        }
        return;
      }
      try {
        const me = await fetchMe(stored);
        if (cancelled) return;
        setUser(me);
        setToken(stored);
        scheduleRefresh(stored);
        // If user is on login page but already authenticated, redirect to home
        if (PUBLIC_PATHS.includes(pathname)) {
          router.replace("/");
        }
      } catch {
        if (cancelled) return;
        clearTokens();
        if (!PUBLIC_PATHS.includes(pathname)) {
          router.replace("/login");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await postLogin(email, password);
    storeTokens(data.token, data.refreshToken);
    setToken(data.token);
    setUser(data.user);
    scheduleRefresh(data.token);
    router.push("/");
  }, [router, scheduleRefresh]);

  const register = useCallback(async (email: string, password: string, name: string, role?: string) => {
    const data = await postRegister(email, password, name, role ?? "editor");
    storeTokens(data.token, data.refreshToken);
    setToken(data.token);
    setUser(data.user);
    scheduleRefresh(data.token);
    router.push("/");
  }, [router, scheduleRefresh]);

  const devLogin = useCallback(async (email: string, name: string, role?: string) => {
    const data = await postDevToken(email, name, role ?? "editor");
    storeTokens(data.token);
    setToken(data.token);
    // Fetch user profile with the new token
    const me = await fetchMe(data.token);
    setUser(me);
    scheduleRefresh(data.token);
    router.push("/");
  }, [router, scheduleRefresh]);

  const logout = useCallback(() => {
    clearTokens();
    setToken(null);
    setUser(null);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, devLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
