import { createContext } from 'react';
import type { AuthUser, LoginCredentials, UserRole } from '../types/auth.types';

export interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
