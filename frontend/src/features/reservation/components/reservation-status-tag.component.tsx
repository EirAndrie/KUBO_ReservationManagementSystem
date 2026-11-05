import React from 'react';
import { Tag } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  LoginOutlined,
  LogoutOutlined,
  CloseCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { ReservationStatus } from '../types/reservation.types';
import { STATUS_CONFIG } from '../constants/reservation.constants';

export interface ReservationStatusTagProps {
  status: ReservationStatus;
  style?: React.CSSProperties;
}

const STATUS_ICONS: Record<ReservationStatus, React.ReactNode> = {
  Pending: <ClockCircleOutlined aria-hidden="true" />,
  Confirmed: <CheckCircleOutlined aria-hidden="true" />,
  CheckedIn: <LoginOutlined aria-hidden="true" />,
  CheckedOut: <LogoutOutlined aria-hidden="true" />,
  Cancelled: <CloseCircleOutlined aria-hidden="true" />,
  NoShow: <StopOutlined aria-hidden="true" />,
};

/**
 * Accessible status tag combining icon, semantic text label, and color.
 * Enforces the WCAG 2.2 AA rule: never rely solely on color to convey status.
 */
export const ReservationStatusTag: React.FC<ReservationStatusTagProps> = ({
  status,
  style,
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.Pending;
  const icon = STATUS_ICONS[status] || STATUS_ICONS.Pending;

  return (
    <Tag
      icon={icon}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 6,
        fontSize: '0.8rem',
        fontWeight: 600,
        color: config.color,
        backgroundColor: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        lineHeight: 1.4,
        margin: 0,
        ...style,
      }}
      aria-label={`Status: ${config.label}`}
    >
      <span>{config.label}</span>
    </Tag>
  );
};
