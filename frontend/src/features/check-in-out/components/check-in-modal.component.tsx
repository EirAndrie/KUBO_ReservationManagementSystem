import React from 'react';
import { Modal, Button, Alert, Tag } from 'antd';
import {
  LoginOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ArrivalRecord } from '../types/check-in-out.types';
import { useCheckInKubo, useApproveEarlyCheckIn } from '../hooks/use-check-in-out-mutations.hook';
import { CHECK_IN_OUT_POLICIES } from '../constants/check-in-out.constants';
import styles from './check-in-modal.module.css';

export interface CheckInModalProps {
  arrival: ArrivalRecord | null;
  open: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
}

/**
 * Check-In Confirmation Modal.
 *
 * Implements:
 * - BR-058: Precondition check (only Confirmed reservations can check in).
 * - BR-059: Early check-in verification and explicit approval action.
 * - BR-060: Records actual check-in timestamp and updates kubo status to Occupied.
 * - Frontloaded verbs: "Check In Guest", "Approve Early Check-In & Check In".
 */
export const CheckInModal: React.FC<CheckInModalProps> = ({
  arrival,
  open,
  onCancel,
  onSuccess,
}) => {
  const checkInMutation = useCheckInKubo();
  const approveEarlyMutation = useApproveEarlyCheckIn();

  if (!arrival) return null;

  const { reservation, assignment, isEarly } = arrival;
  const isEarlyApproved = Boolean(assignment.early_check_in_approved);
  const requiresApproval = isEarly && !isEarlyApproved;

  const handleExecuteCheckIn = async () => {
    if (requiresApproval) {
      await approveEarlyMutation.mutateAsync({
        reservationId: reservation.reservation_id,
        kuboId: assignment.kubo_id,
      });
    }

    await checkInMutation.mutateAsync({
      reservationId: reservation.reservation_id,
      kuboId: assignment.kubo_id,
    });

    onCancel();
    onSuccess?.();
  };

  const isPending = checkInMutation.isPending || approveEarlyMutation.isPending;

  return (
    <Modal
      open={open}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0c4a6e', fontSize: '1.15rem' }}>
          <LoginOutlined style={{ color: '#0284c7' }} aria-hidden="true" />
          <span>Confirm Guest Check-In</span>
        </div>
      }
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>,
        <Button
          key="confirm"
          type="primary"
          icon={requiresApproval ? <ExclamationCircleOutlined aria-hidden="true" /> : <CheckCircleOutlined aria-hidden="true" />}
          loading={isPending}
          onClick={handleExecuteCheckIn}
          style={{
            background: requiresApproval ? '#d97706' : '#16a34a',
            borderColor: requiresApproval ? '#d97706' : '#16a34a',
            fontWeight: 600,
          }}
        >
          {requiresApproval ? 'Approve Early Check-In & Check In' : 'Check In Guest'}
        </Button>,
      ]}
      destroyOnClose
    >
      {requiresApproval ? (
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined aria-hidden="true" />}
          message="Early Check-In Authorization Required (BR-059)"
          description={`The scheduled arrival date is ${dayjs(assignment.check_in_date).format('MMMM D, YYYY')}. Checking in today requires staff override approval and will be audited.`}
        />
      ) : (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          icon={<InfoCircleOutlined aria-hidden="true" />}
          message="Occupancy Transition Notice (BR-060)"
          description={CHECK_IN_OUT_POLICIES.CHECKIN_EFFECTS}
        />
      )}

      <div className={styles.summaryCard}>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Guest Name</span>
          <span className={styles.value}>{reservation.guest_name}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Reference Code</span>
          <Tag color="blue" style={{ fontFamily: 'monospace', margin: 0, fontWeight: 700 }}>
            {reservation.reference_code}
          </Tag>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Kubo Cottage</span>
          <span className={styles.value}>
            Kubo {assignment.kubo_number || assignment.kubo_id.slice(0, 4)} ({assignment.type_name || 'Standard'})
          </span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Scheduled Check-In</span>
          <span style={{ fontWeight: 600 }}>
            {dayjs(assignment.check_in_date).format('MMM D, YYYY')}
          </span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Scheduled Check-Out</span>
          <span style={{ fontWeight: 600 }}>
            {dayjs(assignment.check_out_date).format('MMM D, YYYY')}
          </span>
        </div>
      </div>
    </Modal>
  );
};
