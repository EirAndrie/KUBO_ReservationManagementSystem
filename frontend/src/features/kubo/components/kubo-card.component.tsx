import React from 'react';
import { Tag, Button, Popconfirm, Space } from 'antd';
import {
  CheckCircleOutlined,
  ToolOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/features/auth';
import { useChangeKuboStatus, useDeleteKubo } from '../hooks/use-kubo-mutations.hook';
import { KUBO_STATUS_TAGS, KUBO_STATUS_LABELS } from '../constants/kubo.constants';
import type { Kubo } from '../types/kubo.types';
import styles from './kubo-card.module.css';

/** Philippine Peso currency formatter (BR-048) */
const formatCurrency = (val: number): string =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);

export interface KuboCardProps {
  kubo: Kubo;
  onEdit?: (kubo: Kubo) => void;
  onStatusChange?: (kubo: Kubo) => void;
}

export const KuboCard: React.FC<KuboCardProps> = ({ kubo, onEdit, onStatusChange }) => {
  const { role } = useAuth();
  const isAdmin = role === 'Administrator';

  const statusMutation = useChangeKuboStatus();
  const deleteMutation = useDeleteKubo();

  const tagConfig = KUBO_STATUS_TAGS[kubo.status] || { color: 'default' };

  // Section 12 Housekeeping shortcut: Staff sets 'Cleaning' to 'Available'
  const handleMarkCleaned = () => {
    statusMutation.mutate({ kuboId: kubo.kuboId, status: 'Available' });
  };

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.unitNumber}>{kubo.kuboNumber}</h3>
          <p className={styles.typeName}>{kubo.typeName}</p>
        </div>
        <Tag color={tagConfig.color}>{KUBO_STATUS_LABELS[kubo.status] || kubo.status}</Tag>
      </div>

      {/* Meta Specs */}
      <div className={styles.cardMeta}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Capacity</span>
          <span className={styles.metaValue}>{kubo.capacity} Guests</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Nightly Rate</span>
          <span className={styles.metaValue}>{formatCurrency(kubo.pricePerNight)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.cardActions}>
        {/* Housekeeping Action (Section 12 of flowchart) */}
        {kubo.status === 'Cleaning' && (
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            loading={statusMutation.isPending}
            onClick={handleMarkCleaned}
            style={{ background: '#16a34a', borderColor: '#16a34a', fontSize: '0.78rem' }}
          >
            Mark Cleaned & Available
          </Button>
        )}

        {/* Admin Management Actions */}
        {isAdmin && (
          <Space size="small" style={{ marginLeft: 'auto' }}>
            <Button
              type="text"
              size="small"
              icon={<ToolOutlined />}
              onClick={() => onStatusChange?.(kubo)}
              title="Change Status"
            />
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit?.(kubo)}
              title="Edit Details"
            />
            <Popconfirm
              title="Delete Cottage Unit"
              description="KUBOS WITH HISTORY CANNOT BE DELETED. Mark Out of Service instead (BR-023)."
              onConfirm={() => deleteMutation.mutate(kubo.kuboId)}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
            >
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                title="Delete Unit"
              />
            </Popconfirm>
          </Space>
        )}

        {!isAdmin && kubo.status !== 'Cleaning' && (
          <Button
            type="text"
            size="small"
            icon={<SafetyCertificateOutlined />}
            onClick={() => onStatusChange?.(kubo)}
            style={{ fontSize: '0.78rem', color: '#64748b' }}
          >
            Update Readiness
          </Button>
        )}
      </div>
    </div>
  );
};
