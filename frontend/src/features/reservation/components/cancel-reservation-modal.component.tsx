import React, { useState } from 'react';
import { Input, Modal } from 'antd';
import { useCancelReservation } from '../hooks/use-reservation-mutations.hook';
import { RESERVATION_LIMITS } from '../constants/reservation.constants';
import type { Reservation } from '../types/reservation.types';
import { Callout } from '@/components/common';

export interface CancelReservationModalProps {
  reservation: Pick<Reservation, 'reservation_id' | 'reference_code' | 'guest_name'> | null;
  onClose: () => void;
}

/** Confirms a cancellation, states the consequence, and requires a reason (BR-035). */
export const CancelReservationModal: React.FC<CancelReservationModalProps> = ({ reservation, onClose }) => {
  const [reason, setReason] = useState('');
  const cancel = useCancelReservation();

  const submit = async () => {
    if (!reservation || !reason.trim()) return;
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
      okButtonProps={{ danger: true, loading: cancel.isPending, disabled: !reason.trim() }}
      cancelButtonProps={{ disabled: cancel.isPending }}
      onOk={submit}
      onCancel={onClose}
      afterOpenChange={(visible) => !visible && setReason('')}
      destroyOnHidden
    >
      <Callout tone="danger" style={{ marginBottom: 12 }}>
        {reservation?.guest_name ? `${reservation.guest_name}'s` : 'This'} booking will be cancelled and its kubos
        released. This can't be undone.
      </Callout>
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
