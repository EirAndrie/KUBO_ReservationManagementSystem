import React, { useMemo, useState } from 'react';
import { Modal, Select } from 'antd';
import { Callout } from '@/components/common';
import { formatMoney } from '@/lib/format';
import { useAvailableKubos } from '../hooks/use-reservations.hook';
import { useReassignAssignment } from '../hooks/use-reservation-mutations.hook';
import type { Reservation, ReservationAssignment } from '../types/reservation.types';

interface BodyProps {
  reservation: Reservation;
  assignment: ReservationAssignment;
  onClose: () => void;
}

/**
 * Replaces one kubo on a reservation with another for the same dates, for example
 * when the assigned kubo has gone Out of Service or Under Maintenance. Only kubos
 * the server reports as free for those dates are offered; availability, the new
 * rate, totals and the audit rows are all decided by the server.
 */
const ReassignKuboBody: React.FC<BodyProps> = ({ reservation, assignment, onClose }) => {
  const reassign = useReassignAssignment();
  const [newKuboId, setNewKuboId] = useState<string>();
  const availability = useAvailableKubos({
    checkIn: assignment.check_in_date,
    checkOut: assignment.check_out_date,
  });

  const heldKuboIds = useMemo(
    () => new Set(reservation.assignments.map((a) => a.kubo_id)),
    [reservation.assignments],
  );

  const options = useMemo(
    () =>
      (availability.data ?? [])
        .filter((k) => !heldKuboIds.has(k.kubo_id))
        .map((k) => ({
          value: k.kubo_id,
          label: `${k.kubo_number} · ${k.type_name} · ${formatMoney(k.price_per_night)}/night`,
        })),
    [availability.data, heldKuboIds],
  );

  const submit = async () => {
    if (!newKuboId) return;
    try {
      await reassign.mutateAsync({
        reservationId: reservation.reservation_id,
        kuboId: assignment.kubo_id,
        newKuboId,
      });
      onClose();
    } catch {
      // Server message shown by the mutation toast; keep the form open.
    }
  };

  return (
    <Modal
      open
      title={`Reassign kubo ${assignment.kubo_number}`}
      okText="Reassign"
      cancelText="Close"
      okButtonProps={{ loading: reassign.isPending, disabled: !newKuboId }}
      cancelButtonProps={{ disabled: reassign.isPending }}
      onOk={submit}
      onCancel={onClose}
      destroyOnHidden
    >
      <Callout tone="info" style={{ marginBottom: 12 }}>
        The new kubo keeps the same dates ({assignment.check_in_date} to {assignment.check_out_date}) and is
        charged at today&apos;s rate, which can differ from the rate already booked. The reservation
        stays confirmed and its total updates automatically.
      </Callout>
      <label htmlFor="reassign-kubo-select" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
        Replacement kubo
      </label>
      <Select
        id="reassign-kubo-select"
        style={{ width: '100%' }}
        placeholder="Choose an available kubo"
        value={newKuboId}
        options={options}
        loading={availability.isLoading}
        showSearch
        optionFilterProp="label"
        onChange={setNewKuboId}
        notFoundContent={availability.isLoading ? 'Loading…' : 'No kubos available for these dates.'}
      />
    </Modal>
  );
};

export interface ReassignKuboModalProps {
  /** The reservation, or null when closed. Staff and status are gated by the caller. */
  reservation: Reservation | null;
  /** The Reserved assignment to replace. */
  assignment: ReservationAssignment | null;
  onClose: () => void;
}

/** Swaps a Reserved kubo assignment of a Pending or Confirmed reservation for another kubo. */
export const ReassignKuboModal: React.FC<ReassignKuboModalProps> = ({ reservation, assignment, onClose }) =>
  reservation && assignment ? (
    <ReassignKuboBody
      key={`${reservation.reservation_id}:${assignment.kubo_id}`}
      reservation={reservation}
      assignment={assignment}
      onClose={onClose}
    />
  ) : null;
