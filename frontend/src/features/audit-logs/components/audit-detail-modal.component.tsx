import React from 'react';
import { Modal, Button, Tag } from 'antd';
import { AuditOutlined, FieldTimeOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { AUDIT_ACTION_TAGS, AUDIT_ACTION_LABELS, AUDIT_POLICIES } from '../constants/audit-log.constants';
import type { AuditLog } from '../types/audit-log.types';
import styles from './audit-detail-modal.module.css';

export interface AuditDetailModalProps {
  open: boolean;
  onClose: () => void;
  log: AuditLog | null;
}

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({ open, onClose, log }) => {
  if (!log) return null;

  const tagConfig = AUDIT_ACTION_TAGS[log.action] || { color: 'default' };

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AuditOutlined />
          Audit Record: {log.auditLogId.slice(0, 12)}
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      destroyOnClose
      width={680}
    >
      <div className={styles.modalContent}>
        {/* Header Metadata */}
        <div className={styles.headerMeta}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Action Performed</span>
            <div>
              <Tag color={tagConfig.color}>{AUDIT_ACTION_LABELS[log.action] || log.action}</Tag>
            </div>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Timestamp</span>
            <span className={styles.metaValue}>
              <FieldTimeOutlined style={{ marginRight: 4 }} />
              {dayjs(log.dateTime).format('MMM D, YYYY h:mm:ss A')}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Actor / Employee</span>
            <span className={styles.metaValue}>
              <UserOutlined style={{ marginRight: 4 }} />
              {log.employeeName || log.employeeId.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Description Box */}
        <div className={styles.descBox}>
          <div className={styles.descLabel}>Activity Description</div>
          <p className={styles.descText}>{log.description}</p>
        </div>

        {/* Entity Reference */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
            Target Entity:
          </span>{' '}
          <Tag color="blue">{log.entityType || 'General Entity'}</Tag>
          <span style={{ fontSize: '0.82rem', color: '#334155', fontFamily: 'monospace' }}>
            ID: {log.entityId}
          </span>
        </div>

        {/* Visual State Change Diff */}
        <div className={styles.diffGrid}>
          <div className={styles.diffColumn}>
            <span className={styles.diffTitle}>Previous State (old_values)</span>
            <div className={styles.diffBox}>
              {log.oldValues ? JSON.stringify(log.oldValues, null, 2) : '(none)'}
            </div>
          </div>
          <div className={styles.diffColumn}>
            <span className={styles.diffTitle}>New State (new_values)</span>
            <div className={styles.diffBox}>
              {log.newValues ? JSON.stringify(log.newValues, null, 2) : '(none)'}
            </div>
          </div>
        </div>

        <div className={styles.policyNote}>
          {AUDIT_POLICIES.IMMUTABILITY} {AUDIT_POLICIES.SENSITIVE_DATA_EXCLUSION}
        </div>
      </div>
    </Modal>
  );
};
