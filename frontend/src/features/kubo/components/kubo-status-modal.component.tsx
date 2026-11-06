import React, { useState } from 'react';
import { Modal, Select } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { useChangeKuboStatus } from '../hooks/use-kubo-mutations.hook';
import { KUBO_STATUS_OPTIONS, KUBO_POLICIES } from '../constants/kubo.constants';
import type { Kubo, KuboStatus } from '../types/kubo.types';

export interface KuboStatusModalProps {
  open: boolean;
  onClose: () => void;
  kubo: Kubo | null;
}

export const KuboStatusModal: React.FC<KuboStatusModalProps> = ({ open, onClose, kubo }) => {
  const [statusSelection, setStatusSelection] = useState<{
    kuboId: string;
    status: KuboStatus;
  } | null>(null);
  const selectedStatus =
    kubo && statusSelection?.kuboId === kubo.kuboId
      ? statusSelection.status
      : kubo?.status ?? 'Available';
  const statusMutation = useChangeKuboStatus();

  const handleConfirm = async () => {
    if (!kubo) return;
    try {
      await statusMutation.mutateAsync({
        kuboId: kubo.kuboId,
        status: selectedStatus,
      });
      onClose();
    } catch {
      // Handled
    }
  };

  if (!kubo) return null;

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ToolOutlined />
          Update Cottage Status: {kubo.kuboNumber}
        </span>
      }
      open={open}
      onCancel={onClose}
      onOk={handleConfirm}
      okText="Change status"
      okButtonProps={{ loading: statusMutation.isPending }}
      destroyOnClose
      width={460}
    >
      <div style={{ padding: '8px 0' }}>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', marginBottom: 16 }}>
          Set the operational or housekeeping condition for <strong>{kubo.kuboNumber}</strong> ({kubo.typeName}):
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Unit Status
          </label>
          <Select
            value={selectedStatus}
            onChange={(val) => kubo && setStatusSelection({ kuboId: kubo.kuboId, status: val })}
            options={KUBO_STATUS_OPTIONS}
            style={{ width: '100%' }}
            size="large"
          />
        </div>

        <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: 0 }}>
          {KUBO_POLICIES.HOUSEKEEPING_READINESS}
        </p>
      </div>
    </Modal>
  );
};
