import React from 'react';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { EllipsisOutlined } from '@ant-design/icons';

export type RowMenuItem =
  | {
      key: string;
      label: React.ReactNode;
      icon?: React.ReactNode;
      danger?: boolean;
      disabled?: boolean;
      /** Shown as a native tooltip when the item is disabled. */
      reason?: string;
      onClick: () => void;
    }
  | { key: string; divider: true };

/**
 * The `⋯` menu that holds rare and destructive row actions. Clicks do not
 * bubble to the row, so a row click can still open the record.
 */
export const RowMenu: React.FC<{ items: RowMenuItem[]; label?: string }> = ({ items, label = 'More actions' }) => {
  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;

  const menuItems: MenuProps['items'] = visible.map((item) =>
    'divider' in item
      ? { type: 'divider' as const, key: item.key }
      : {
          key: item.key,
          icon: item.icon,
          danger: item.danger,
          disabled: item.disabled,
          label: item.disabled && item.reason ? <span title={item.reason}>{item.label}</span> : item.label,
          onClick: ({ domEvent }) => {
            domEvent.stopPropagation();
            item.onClick();
          },
        },
  );

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
      <Button
        type="text"
        size="small"
        icon={<EllipsisOutlined />}
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      />
    </Dropdown>
  );
};
