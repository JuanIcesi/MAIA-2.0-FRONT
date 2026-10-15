import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { authAPI, usersAPI } from '../services/api';
import { findKnownBackendRole } from '../utils/roles';
import type { UserRole } from '../utils/roles';

export type { UserRole } from '../utils/roles';

const AUTH_UNAUTHORIZED_EVENT = 'maia:auth:unauthorized';

export interface User {
  id: string;
  idNumber: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  academicArea?: string;
  isAdministrator?: boolean;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => void;
  refreshSession: () => Promise<User | null>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const decodeJWT = (token: string): Record<string, unknown> | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

function userFromToken(decoded: Record<string, unknown>): User | null {
  const expiresAt = typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
  if (expiresAt !== null && expiresAt <= Date.now()) return null;

  const role = findKnownBackendRole(decoded.roles ?? decoded.role);
  const email = typeof decoded.email === 'string' ? decoded.email.trim() : '';
  if (!role || !email) return null;

  return {
    id: String(decoded.userId ?? email),
    idNumber: email,
    name: String(decoded.name ?? email),
    email,
    role,
    department: String(decoded.departmentName ?? ''),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async (): Promise<User | null> => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setUser(null);
      return null;
    }
    try {
      const profile = await usersAPI.getMe();
      setUser(profile);
      return profile;
    } catch (error) {
      const currentToken = localStorage.getItem('authToken');
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? (error as { status?: unknown }).status
          : undefined;
      if (!currentToken || (typeof status === 'number' && status < 500)) {
        localStorage.removeItem('authToken');
        setUser(null);
        return null;
      }

      const decoded = decodeJWT(token);
      if (decoded) {
        const fallback = userFromToken(decoded);
        if (fallback) {
          setUser(fallback);
          return fallback;
        }
      }
      localStorage.removeItem('authToken');
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setIsLoading(false);
      return;
    }

    refreshSession().finally(() => setIsLoading(false));
  }, [refreshSession]);

  useEffect(() => {
    const clearSession = () => setUser(null);
    const syncSession = (event: StorageEvent) => {
      if (event.key === 'authToken' && !event.newValue) clearSession();
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, clearSession);
    window.addEventListener('storage', syncSession);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, clearSession);
      window.removeEventListener('storage', syncSession);
    };
  }, []);

  const login = async (email: string, password: string): Promise<User | null> => {
    try {
      const response = await authAPI.login({ email, password });
      setUser(response.user);
      return response.user;
    } catch (error) {
      setUser(null);
      throw error;
    }
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
  };

  const updateProfile = (updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, updateProfile, refreshSession, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
