import React from 'react';
import { Card, Button, Popconfirm, Typography } from 'antd';
import {
  TeamOutlined,
  EditOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import type { KuboType } from '../types/kubo-type.types';
import styles from './kubo-type-card.module.css';

const { Title, Paragraph } = Typography;

export interface KuboTypeCardProps {
  /** The KuboType entity to present */
  kuboType: KuboType;
  /** Callback fired when user requests editing this kubo type */
  onEdit?: (kuboType: KuboType) => void;
  /** Callback fired when user confirms deletion */
  onDelete?: (kuboTypeId: string) => void;
  /** Loading state flag indicating delete operation is actively executing */
  isDeleting?: boolean;
  /** Flag denoting whether this card is currently selected or focused */
  isSelected?: boolean;
  /** Optional click handler to select this card */
  onSelect?: (kuboType: KuboType) => void;
}

/**
 * Presentation card for displaying a single Kubo Type category.
 *
 * Implements design tokens and intent-driven styling:
 * - Affirmative and informational presentation of capacity and rate.
 * - Intent-by-token: Danger-variant styling strictly assigned to deletion.
 * - Fully accessible with keyboard tab-indexing and aria-labels.
 * - Zero emoji policy: Visual markers powered purely by Ant Design icons.
 */
export const KuboTypeCard: React.FC<KuboTypeCardProps> = ({
  kuboType,
  onEdit,
  onDelete,
  isDeleting = false,
  isSelected = false,
  onSelect,
}) => {
  const formattedRate = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(kuboType.price_per_night) || 0);

  const cardClasses = [
    styles.card,
    isSelected ? styles.cardSelected : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Card
      className={cardClasses}
      bordered={false}
      bodyStyle={{ padding: 20, display: 'flex', flexDirection: 'column', height: '100%' }}
      tabIndex={0}
      role="region"
      aria-label={`Kubo Type: ${kuboType.type_name}`}
      onClick={() => onSelect?.(kuboType)}
    >
      <div className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <Title level={4} className={styles.typeName} title={kuboType.type_name}>
            {kuboType.type_name}
          </Title>
          <span className={styles.badgeCapacity} aria-label={`Capacity: ${kuboType.capacity} persons`}>
            <TeamOutlined aria-hidden="true" />
            <span>Up to {kuboType.capacity} {kuboType.capacity === 1 ? 'guest' : 'guests'}</span>
          </span>
        </div>
      </div>

      <Paragraph
        className={styles.description}
        ellipsis={{ rows: 3, expandable: false }}
        title={kuboType.description ?? undefined}
      >
        {kuboType.description?.trim() ? kuboType.description : 'No descriptive details specified for this category.'}
      </Paragraph>

      <div className={styles.rateContainer}>
        <span className={styles.rateLabel}>Standard Nightly Rate</span>
        <div className={styles.rateValue}>
          <span>{formattedRate}</span>
          <span className={styles.ratePerNight}>/ night</span>
        </div>
      </div>

      <div className={styles.actionsBar} onClick={(e) => e.stopPropagation()}>
        <Button
          type="default"
          icon={<EditOutlined aria-hidden="true" />}
          onClick={() => onEdit?.(kuboType)}
          aria-label={`Edit ${kuboType.type_name}`}
        >
          Edit
        </Button>

        <Popconfirm
          title="Delete kubo type"
          description={
            <div style={{ maxWidth: 260 }}>
              <span>
                Are you sure you want to delete <strong>{kuboType.type_name}</strong>?
              </span>
              <br />
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                Note: Kubo types with active cottages cannot be deleted (BR-022).
              </span>
            </div>
          }
          onConfirm={() => onDelete?.(kuboType.kubo_type_id)}
          okText="Delete"
          cancelText="Cancel"
          okButtonProps={{ danger: true, loading: isDeleting }}
          icon={<QuestionCircleOutlined style={{ color: '#ff4d4f' }} aria-hidden="true" />}
        >
          <Button
            danger
            icon={<DeleteOutlined aria-hidden="true" />}
            loading={isDeleting}
            aria-label={`Delete ${kuboType.type_name}`}
          >
            Delete
          </Button>
        </Popconfirm>
      </div>
    </Card>
  );
};
