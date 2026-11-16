import React, { useMemo, useState } from 'react';
import { DatePicker, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { Callout } from '@/components/common';
import { formatMoney, nightsBetween, pluralize } from '@/lib/format';
import { resortToday } from '@/lib/time';
import { useAvailableKubos } from '../hooks/use-reservations.hook';
import { useAddAssignment } from '../hooks/use-reservation-mutations.hook';
import { stayOf } from '../utils/reservation.utils';
import type { Reservation } from '../types/reservation.types';

const { RangePicker } = DatePicker;
const DATE_FORMAT = 'YYYY-MM-DD';

interface BodyProps {
  reservation: Reservation;
  onClose: () => void;
}

/**
 * Adds one kubo assignment to an existing reservation (BR-037). Dates default to
 * the reservation's current stay; each assignment keeps its own range. Only kubos
 * the server reports as free for those dates are offered, and kubos already on this
 * reservation are filtered out. Availability, the rate snapshot, totals, and the
 * audit row all come from the server — nothing is computed here.
 */
const AddKuboBody: React.FC<BodyProps> = ({ reservation, onClose }) => {
  const add = useAddAssignment();
  const stay = useMemo(() => stayOf(reservation.assignments), [reservation.assignments]);

  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => {
    const today = dayjs(resortToday());
    // Never default to a past check-in: the server rejects those.
    const start = stay.checkIn && dayjs(stay.checkIn).isAfter(today) ? dayjs(stay.checkIn) : today;
    const end = stay.checkOut && dayjs(stay.checkOut).isAfter(start) ? dayjs(stay.checkOut) : start.add(1, 'day');
    return [start, end];
  });
  const [kuboId, setKuboId] = useState<string>();

  const checkIn = range[0].format(DATE_FORMAT);
  const checkOut = range[1].format(DATE_FORMAT);
  const nights = nightsBetween(checkIn, checkOut);
  const availability = useAvailableKubos({ checkIn, checkOut });

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

  const canSubmit = Boolean(kuboId) && nights > 0 && !add.isPending;
  // Once per render, not once per calendar cell.
  const today = resortToday();

  const submit = async () => {
    if (!kuboId || nights <= 0) return;
    try {
      await add.mutateAsync({
        reservationId: reservation.reservation_id,
        data: { kuboId, checkInDate: checkIn, checkOutDate: checkOut },
      });
      onClose();
    } catch {
      // Server message shown by the mutation toast; keep the form open.
    }
  };

  return (
    <Modal
      open
      title={`Add a kubo to ${reservation.reference_code}`}
      okText="Add kubo"
      cancelText="Close"
      okButtonProps={{ loading: add.isPending, disabled: !canSubmit }}
      cancelButtonProps={{ disabled: add.isPending }}
      onOk={submit}
      onCancel={onClose}
      destroyOnHidden
    >
      <Callout tone="info" style={{ marginBottom: 12 }}>
        The kubo is charged at the rate in effect today, which can differ from the rates already
        booked, and the reservation total updates automatically.
      </Callout>
      <label htmlFor="add-kubo-dates" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
        Stay dates
      </label>
      <RangePicker
        id="add-kubo-dates"
        style={{ width: '100%', marginBottom: 6 }}
        value={range}
        allowClear={false}
        disabledDate={(current) => Boolean(current) && current.format(DATE_FORMAT) < today}
        onChange={(dates) => {
          if (!dates?.[0] || !dates[1]) return;
          setRange([dates[0], dates[1]]);
          // Availability is date-dependent, so the previous pick may no longer be free.
          setKuboId(undefined);
        }}
      />
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
        {nights > 0 ? pluralize(nights, 'night') : 'Check-out must be later than check-in.'}
      </p>
      <label htmlFor="add-kubo-select" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
        Kubo
      </label>
      <Select
        id="add-kubo-select"
        style={{ width: '100%' }}
        placeholder="Choose an available kubo"
        value={kuboId}
        options={options}
        loading={availability.isLoading}
        showSearch
        optionFilterProp="label"
        onChange={setKuboId}
        notFoundContent={
          availability.isLoading ? 'Loading…' : 'No kubos available for these dates.'
        }
      />
    </Modal>
  );
};

export interface AddKuboModalProps {
  /** The reservation to add a kubo to, or null when closed. Staff + status are gated by the caller. */
  reservation: Reservation | null;
  onClose: () => void;
}

/**
 * Adds another kubo assignment to a Pending or Confirmed reservation before any
 * check-in (BR-037). Staff only; the caller decides when to show the entry point.
 */
export const AddKuboModal: React.FC<AddKuboModalProps> = ({ reservation, onClose }) =>
  reservation ? (
    <AddKuboBody key={reservation.reservation_id} reservation={reservation} onClose={onClose} />
  ) : null;
