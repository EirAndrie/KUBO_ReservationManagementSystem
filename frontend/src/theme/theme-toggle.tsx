import React from 'react';
import { Button, Tooltip } from 'antd';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useThemeMode } from './theme-context';

/** Icon button that switches between light and dark mode. */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { mode, toggle } = useThemeMode();
  const next = mode === 'dark' ? 'light' : 'dark';
  return (
    <Tooltip title={`Switch to ${next} mode`}>
      <Button
        type="text"
        className={className}
        icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
        onClick={toggle}
        aria-label={`Switch to ${next} mode`}
        aria-pressed={mode === 'dark'}
      />
    </Tooltip>
  );
};
