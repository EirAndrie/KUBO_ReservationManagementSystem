import React, { useState, useMemo, useCallback } from 'react';
import { authService } from '../services/auth.service';
import { AuthContext } from './auth-context';
import type { AuthContextType } from './auth-context';
import type { AuthUser, LoginCredentials } from '../types/auth.types';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => authService.getCurrentUser());

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthUser> => {
    const loggedUser = await authService.login(credentials);
    setUser(loggedUser);
    return loggedUser;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextType>(() => {
    const role = user?.role ?? null;
    return {
      user,
      role,
      isAuthenticated: Boolean(user),
      isAdmin: role === 'Administrator',
      isStaff: role === 'Staff',
      login,
      logout,
    };
  }, [user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
