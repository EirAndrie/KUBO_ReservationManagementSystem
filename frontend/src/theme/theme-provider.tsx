import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App as AntApp, ConfigProvider, theme as antdTheme } from 'antd';
import type { ThemeConfig } from 'antd';
import { ThemeContext, type ThemeMode } from './theme-context';

const STORAGE_KEY = 'kubo_theme';

/** Token values mirrored from src/index.css so antd components match the shell. */
const TOKENS: Record<ThemeMode, Record<string, string>> = {
  light: {
    primary: '#0c4a6e',
    onPrimary: '#ffffff',
    text: '#1c1917',
    muted: '#6b6660',
    border: '#e8e6e1',
    bg: '#f7f7f5',
    surface: '#ffffff',
    hover: '#f3f2ef',
    primarySoft: '#eaf3f8',
    success: '#15803d',
    warning: '#b45309',
    error: '#b91c1c',
  },
  dark: {
    primary: '#5ab0e0',
    onPrimary: '#0b1a24',
    text: '#f2f1ee',
    muted: '#a8a29e',
    border: '#2f2d2a',
    bg: '#141413',
    surface: '#1e1d1b',
    hover: '#282725',
    primarySoft: '#14334a',
    success: '#4ade80',
    warning: '#fbbf24',
    error: '#f87171',
  },
};

function readInitialMode(): ThemeMode {
  const fromDom = document.documentElement.dataset.theme;
  if (fromDom === 'dark' || fromDom === 'light') return fromDom;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Storage can be unavailable (private mode); fall through to the OS preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function buildTheme(mode: ThemeMode): ThemeConfig {
  const t = TOKENS[mode];
  return {
    algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: t.primary,
      colorInfo: t.primary,
      colorLink: t.primary,
      colorSuccess: t.success,
      colorWarning: t.warning,
      colorError: t.error,
      colorText: t.text,
      colorTextSecondary: t.muted,
      colorTextTertiary: t.muted,
      colorTextLightSolid: t.onPrimary,
      colorBorder: t.border,
      colorBorderSecondary: t.border,
      colorBgLayout: t.bg,
      colorBgContainer: t.surface,
      colorBgElevated: t.surface,
      colorFillAlter: mode === 'dark' ? '#22211f' : '#fbfbfa',
      controlItemBgActive: t.primarySoft,
      controlItemBgHover: t.hover,
      borderRadius: 7,
      borderRadiusLG: 10,
      controlHeight: 32,
      fontSize: 13,
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    },
    components: {
      Table: {
        headerBg: mode === 'dark' ? '#22211f' : '#fbfbfa',
        rowHoverBg: t.hover,
        headerSplitColor: 'transparent',
        cellPaddingBlock: 8,
      },
      Card: { borderRadiusLG: 10 },
      Drawer: { colorBgElevated: t.surface },
      Tabs: { horizontalMargin: '0 0 12px 0' },
      Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none' },
    },
  };
}

/**
 * Owns the light/dark mode. Persists the choice in localStorage, mirrors it to
 * `<html data-theme>` for the CSS tokens, and feeds the matching antd theme.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(readInitialMode);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Non-persistent session; the toggle still works for this tab.
    }
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => setModeState(next), []);
  const toggle = useCallback(() => setModeState((m) => (m === 'dark' ? 'light' : 'dark')), []);

  const value = useMemo(() => ({ mode, toggle, setMode }), [mode, toggle, setMode]);
  const config = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={config}>
        <AntApp>{children}</AntApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};
