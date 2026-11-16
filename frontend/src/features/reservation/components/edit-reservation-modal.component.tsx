import React, { useMemo, useState } from 'react';
import { DatePicker, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { resortToday } from '@/lib/time';
import type { Dayjs } from 'dayjs';
import { Callout } from '@/components/common';
import { useAvailableKubos } from '../hooks/use-reservations.hook';
import { useEditReservation } from '../hooks/use-reservation-mutations.hook';
import { BOOKING_SOURCE_OPTIONS } from '../constants/reservation.constants';
import type { BookingSource, Reservation, ReservationAssignment } from '../types/reservation.types';

const { RangePicker } = DatePicker;
const DATE_FORMAT = 'YYYY-MM-DD';

interface RowState {
  range: [Dayjs, Dayjs];
  /** Replacement kubo, or the current one when unchanged. */
  kuboId: string;
}

interface AssignmentRowProps {
  assignment: ReservationAssignment;
  value: RowState;
  onChange: (next: RowState) => void;
}

/** One editable kubo assignment: its stay dates and the kubo itself. */
const AssignmentRow: React.FC<AssignmentRowProps> = ({ assignment, value, onChange }) => {
  const checkIn = value.range[0].format(DATE_FORMAT);
  const checkOut = value.range[1].format(DATE_FORMAT);
  const availability = useAvailableKubos({ checkIn, checkOut });

  const options = useMemo(() => {
    const list = (availability.data ?? []).map((k) => ({
      value: k.kubo_id,
      label: `${k.kubo_number} · ${k.type_name}`,
    }));
    // The current kubo may not appear as "available" because this reservation holds it.
    if (!list.some((o) => o.value === assignment.kubo_id)) {
      list.unshift({
        value: assignment.kubo_id,
        label: `${assignment.kubo_number ?? 'Current kubo'} · ${assignment.type_name ?? ''} (current)`,
      });
    }
    return list;
  }, [availability.data, assignment]);

  return (
    <div style={{ display: 'grid', gap: 8, padding: '12px 0', borderTop: '1px solid var(--color-border, #e5e7eb)' }}>
      <div style={{ fontWeight: 600 }}>{assignment.kubo_number ?? 'Kubo'}</div>
      <RangePicker
        style={{ width: '100%' }}
        value={value.range}
        allowClear={false}
        disabledDate={(current) => current && current.format('YYYY-MM-DD') < resortToday()}
        onChange={(dates) => dates?.[0] && dates[1] && onChange({ ...value, range: [dates[0], dates[1]] })}
      />
      <Select
        value={value.kuboId}
        options={options}
        loading={availability.isLoading}
        onChange={(kuboId) => onChange({ ...value, kuboId })}
        aria-label={`Kubo for ${assignment.kubo_number ?? 'assignment'}`}
      />
    </div>
  );
};

interface BodyProps {
  reservation: Reservation;
  onClose: () => void;
}

const EditReservationBody: React.FC<BodyProps> = ({ reservation, onClose }) => {
  const edit = useEditReservation();
  // Only assignments that have not been checked in can still change (BR-037).
  const editable = useMemo(
    () => reservation.assignments.filter((a) => (a.status ?? 'Reserved') === 'Reserved'),
    [reservation.assignments],
  );

  const [bookingSource, setBookingSource] = useState<BookingSource>(reservation.booking_source);
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      editable.map((a) => [
        a.kubo_id,
        { range: [dayjs(a.check_in_date), dayjs(a.check_out_date)] as [Dayjs, Dayjs], kuboId: a.kubo_id },
      ]),
    ),
  );

  const assignmentChanges = editable.flatMap((a) => {
    const row = rows[a.kubo_id];
    const checkInDate = row.range[0].format(DATE_FORMAT);
    const checkOutDate = row.range[1].format(DATE_FORMAT);
    const datesChanged =
      checkInDate !== dayjs(a.check_in_date).format(DATE_FORMAT) ||
      checkOutDate !== dayjs(a.check_out_date).format(DATE_FORMAT);
    const kuboChanged = row.kuboId !== a.kubo_id;
    if (!datesChanged && !kuboChanged) return [];
    return [{ oldKuboId: a.kubo_id, checkInDate, checkOutDate, newKuboId: kuboChanged ? row.kuboId : undefined }];
  });
  const sourceChanged = bookingSource !== reservation.booking_source;
  const dirty = sourceChanged || assignmentChanges.length > 0;

  const save = async () => {
    try {
      await edit.mutateAsync({
        reservationId: reservation.reservation_id,
        bookingSource: sourceChanged ? bookingSource : undefined,
        assignmentChanges,
      });
      onClose();
    } catch {
      // Server message shown by the mutation toast; keep the form open.
    }
  };

  return (
    <Modal
      open
      title={`Edit ${reservation.reference_code}`}
      okText="Save changes"
      cancelText="Close"
      okButtonProps={{ loading: edit.isPending, disabled: !dirty }}
      cancelButtonProps={{ disabled: edit.isPending }}
      onOk={save}
      onCancel={onClose}
      destroyOnHidden
    >
      <Callout tone="info" style={{ marginBottom: 12 }}>
        Dates and kubos can be changed until check-in. Availability is re-checked when you save, and price
        for changed stays follows the kubo type's current rate.
      </Callout>
      <label htmlFor="edit-booking-source" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
        Booking source
      </label>
      <Select
        id="edit-booking-source"
        style={{ width: '100%', marginBottom: 12 }}
        value={bookingSource}
        options={BOOKING_SOURCE_OPTIONS}
        onChange={setBookingSource}
      />
      {editable.length === 0 ? (
        <Callout tone="warn">No kubo on this reservation can be changed because every one is already checked in.</Callout>
      ) : (
        editable.map((a) => (
          <AssignmentRow
            key={a.kubo_id}
            assignment={a}
            value={rows[a.kubo_id]}
            onChange={(next) => setRows((prev) => ({ ...prev, [a.kubo_id]: next }))}
          />
        ))
      )}
    </Modal>
  );
};

export interface EditReservationModalProps {
  /** The reservation to edit, or null when closed. */
  reservation: Reservation | null;
  onClose: () => void;
}

/**
 * Edits a Pending or Confirmed reservation before check-in (BR-037): booking
 * source, stay dates and kubo per assignment. Staff only; the caller gates it.
 */
export const EditReservationModal: React.FC<EditReservationModalProps> = ({ reservation, onClose }) =>
  reservation ? <EditReservationBody key={reservation.reservation_id} reservation={reservation} onClose={onClose} /> : null;
