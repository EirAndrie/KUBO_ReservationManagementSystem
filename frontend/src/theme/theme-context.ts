import { createContext, useContext } from 'react';

export type ThemeMode = 'light' | 'dark';

export interface ThemeContextValue {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useThemeMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within a ThemeProvider');
  return ctx;
}
