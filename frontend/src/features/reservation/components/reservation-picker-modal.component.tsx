import React, { useState } from 'react';
import { Modal, Select } from 'antd';
import type { Reservation } from '../types/reservation.types';
import { formatMoney, label, toAmount } from '@/lib/format';

export interface ReservationPickerModalProps {
  open: boolean;
  title: string;
  reservations: Reservation[];
  onCancel: () => void;
  onPick: (reservation: Reservation) => void;
}

/** First step of a quick action: choose which active reservation it applies to. */
export const ReservationPickerModal: React.FC<ReservationPickerModalProps> = ({
  open,
  title,
  reservations,
  onCancel,
  onPick,
}) => {
  const [selected, setSelected] = useState<string>();
  const chosen = reservations.find((r) => r.reservation_id === selected);

  return (
    <Modal
      open={open}
      title={title}
      okText="Continue"
      okButtonProps={{ disabled: !chosen }}
      onOk={() => chosen && onPick(chosen)}
      onCancel={onCancel}
      afterOpenChange={(visible) => !visible && setSelected(undefined)}
      destroyOnHidden
    >
      <label htmlFor="pick-reservation" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
        Reservation
      </label>
      <Select
        id="pick-reservation"
        showSearch
        autoFocus
        style={{ width: '100%' }}
        placeholder="Search guest or reference"
        optionFilterProp="label"
        value={selected}
        onChange={setSelected}
        options={reservations.map((r) => ({
          value: r.reservation_id,
          label: `${r.guest_name} · ${r.reference_code} · ${label(r.status)} · ${formatMoney(toAmount(r.outstanding_balance))} due`,
        }))}
        notFoundContent="No active reservations"
      />
    </Modal>
  );
};
