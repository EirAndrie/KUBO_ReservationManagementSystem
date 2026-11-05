import React from 'react';
import { Modal, Button, Alert, Tag } from 'antd';
import {
  LogoutOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CreditCardOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { DepartureRecord } from '../types/check-in-out.types';
import { useCheckOutKubo } from '../hooks/use-check-in-out-mutations.hook';
import { CHECK_IN_OUT_POLICIES } from '../constants/check-in-out.constants';
import styles from './check-in-modal.module.css';

export interface CheckOutModalProps {
  departure: DepartureRecord | null;
  open: boolean;
  onCancel: () => void;
  onRequestPayment: () => void;
  onSuccess?: () => void;
}

/**
 * Check-Out Confirmation Modal.
 *
 * Implements:
 * - BR-062: Check-out preconditions (assignment must be CheckedIn).
 * - BR-063: Records actual check-out timestamp and transitions kubo status to Cleaning.
 * - BR-064: Settlement at check-out — outstanding balance must be zero.
 * - Frontloaded verbs: "Complete Check-Out", "Record Final Payment".
 */
export const CheckOutModal: React.FC<CheckOutModalProps> = ({
  departure,
  open,
  onCancel,
  onRequestPayment,
  onSuccess,
}) => {
  const checkOutMutation = useCheckOutKubo();

  if (!departure) return null;

  const { reservation, assignment, outstandingBalance, isSettled } = departure;

  const handleExecuteCheckOut = async () => {
    if (!isSettled) return;

    await checkOutMutation.mutateAsync({
      reservationId: reservation.reservation_id,
      kuboId: assignment.kubo_id,
    });

    onCancel();
    onSuccess?.();
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(val);

  return (
    <Modal
      open={open}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0c4a6e', fontSize: '1.15rem' }}>
          <LogoutOutlined style={{ color: '#7c3aed' }} aria-hidden="true" />
          <span>Confirm Guest Departure & Check-Out</span>
        </div>
      }
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={checkOutMutation.isPending}>
          Cancel
        </Button>,
        !isSettled ? (
          <Button
            key="pay"
            type="primary"
            icon={<CreditCardOutlined aria-hidden="true" />}
            onClick={() => {
              onCancel();
              onRequestPayment();
            }}
            style={{ background: '#0284c7', borderColor: '#0284c7', fontWeight: 600 }}
          >
            Record Final Payment
          </Button>
        ) : (
          <Button
            key="checkout"
            type="primary"
            icon={<CheckCircleOutlined aria-hidden="true" />}
            loading={checkOutMutation.isPending}
            onClick={handleExecuteCheckOut}
            style={{ background: '#7c3aed', borderColor: '#7c3aed', fontWeight: 600 }}
          >
            Complete Check-Out
          </Button>
        ),
      ]}
      destroyOnClose
    >
      {!isSettled ? (
        <Alert
          style={{ marginTop: 12 }}
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined aria-hidden="true" />}
          message={`Outstanding Balance Remaining: ${formatCurrency(outstandingBalance)}`}
          description="BR-064 requires all accommodation fees and charges to be fully settled before check-out is finalized. Please record the final payment."
        />
      ) : (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          message="Account Settled (₱0.00 Balance)"
          description={CHECK_IN_OUT_POLICIES.CHECKOUT_EFFECTS}
        />
      )}

      <div className={styles.summaryCard}>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Guest Name</span>
          <span className={styles.value}>{reservation.guest_name}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Reference Code</span>
          <Tag color="purple" style={{ fontFamily: 'monospace', margin: 0, fontWeight: 700 }}>
            {reservation.reference_code}
          </Tag>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Kubo Unit</span>
          <span className={styles.value}>
            Kubo {assignment.kubo_number || assignment.kubo_id.slice(0, 4)} ({assignment.type_name || 'Standard'})
          </span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Scheduled Departure</span>
          <span style={{ fontWeight: 600 }}>
            {dayjs(assignment.check_out_date).format('MMM D, YYYY')}
          </span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Account Settlement</span>
          <span
            style={{
              fontWeight: 700,
              color: isSettled ? '#16a34a' : '#dc2626',
            }}
          >
            {isSettled ? 'Fully Settled (₱0.00)' : `Unpaid: ${formatCurrency(outstandingBalance)}`}
          </span>
        </div>
      </div>
    </Modal>
  );
};
