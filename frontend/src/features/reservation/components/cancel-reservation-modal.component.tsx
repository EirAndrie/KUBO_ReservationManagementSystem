import React, { useState } from 'react';
import { Checkbox, Input, Modal } from 'antd';
import { useCancelReservation } from '../hooks/use-reservation-mutations.hook';
import { RESERVATION_LIMITS } from '../constants/reservation.constants';
import type { Reservation } from '../types/reservation.types';
import { Callout } from '@/components/common';
import { formatMoney } from '@/lib/format';

export interface CancelReservationModalProps {
  reservation: Pick<Reservation, 'reservation_id' | 'reference_code' | 'guest_name' | 'net_paid'> | null;
  onClose: () => void;
}

/**
 * Confirms a cancellation, states the consequence, and requires a reason (BR-035).
 * When payments have been received it also shows the amount and requires an
 * acknowledgement, because cancelling never refunds automatically (BR-035, BR-054).
 */
export const CancelReservationModal: React.FC<CancelReservationModalProps> = ({ reservation, onClose }) => {
  const [reason, setReason] = useState('');
  const [ackPaid, setAckPaid] = useState(false);
  const cancel = useCancelReservation();
  const paid = Number(reservation?.net_paid ?? 0);
  const hasPayments = paid > 0;

  const submit = async () => {
    if (!reservation || !reason.trim() || (hasPayments && !ackPaid)) return;
    try {
      await cancel.mutateAsync({ id: reservation.reservation_id, data: { reason: reason.trim() } });
      onClose();
    } catch {
      // Server message shown by the mutation toast.
    }
  };

  return (
    <Modal
      open={Boolean(reservation)}
      title={`Cancel ${reservation?.reference_code ?? 'reservation'}?`}
      okText="Cancel reservation"
      cancelText="Keep reservation"
      okButtonProps={{ danger: true, loading: cancel.isPending, disabled: !reason.trim() || (hasPayments && !ackPaid) }}
      cancelButtonProps={{ disabled: cancel.isPending }}
      onOk={submit}
      onCancel={onClose}
      afterOpenChange={(visible) => {
        if (!visible) {
          setReason('');
          setAckPaid(false);
        }
      }}
      destroyOnHidden
    >
      <Callout tone="danger" style={{ marginBottom: 12 }}>
        {reservation?.guest_name ? `${reservation.guest_name}'s` : 'This'} booking will be cancelled and its kubos
        released. This can't be undone.
      </Callout>
      {hasPayments && (
        <Callout tone="warn" style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 8 }}>
            {formatMoney(paid)} has already been paid on this booking. Cancelling does not refund it. After
            cancelling, use Issue refund on the reservation page to return the money.
          </div>
          <Checkbox checked={ackPaid} onChange={(e) => setAckPaid(e.target.checked)}>
            I understand the payment stays recorded until I refund it
          </Checkbox>
        </Callout>
      )}
      <label htmlFor="cancel-reason" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
        Reason
      </label>
      <Input.TextArea
        id="cancel-reason"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={RESERVATION_LIMITS.MAX_CANCELLATION_REASON}
        showCount
        placeholder="e.g. Guest changed travel plans"
      />
    </Modal>
  );
};
