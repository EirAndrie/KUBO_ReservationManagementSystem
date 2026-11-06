import React, { useState } from 'react';
import { Button, Checkbox, Drawer, Segmented } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useGuest } from '@/features/guest';
import { RecordPaymentModal } from '@/features/payment';
import { Callout, StatusBadge } from '@/components/common';
import { formatMoney, formatStayRange, label, maskId, nightsBetween, pluralize, toAmount } from '@/lib/format';
import { useApproveEarlyCheckIn, useCheckInKubo } from '../hooks/use-check-in-out-mutations.hook';
import type { ArrivalRecord } from '../types/check-in-out.types';
import { isKuboReady } from '../utils/kubo-readiness';
import styles from './check-in-drawer.module.css';

export interface CheckInDrawerProps {
  arrival: ArrivalRecord | null;
  /** Live status of the assigned kubo (from `/kubos`). */
  kuboStatus?: string;
  onClose: () => void;
}

type PaymentChoice = 'now' | 'checkout';

/**
 * Side drawer for checking a guest in. The list stays visible behind it.
 * The confirm button is disabled until every checklist item is ticked and
 * while the kubo isn't ready. Early arrivals are approved first through the
 * existing early-check-in endpoint, then checked in.
 */
export const CheckInDrawer: React.FC<CheckInDrawerProps> = (props) => {
  // Remount per arrival so the checklist starts unticked each time.
  const key = props.arrival ? `${props.arrival.reservation.reservation_id}:${props.arrival.assignment.kubo_id}` : 'none';
  return <CheckInDrawerContent key={key} {...props} />;
};

const CheckInDrawerContent: React.FC<CheckInDrawerProps> = ({ arrival, kuboStatus, onClose }) => {
  const [idChecked, setIdChecked] = useState(false);
  const [detailsConfirmed, setDetailsConfirmed] = useState(false);
  const [keyHanded, setKeyHanded] = useState(false);
  const [payment, setPayment] = useState<PaymentChoice>('checkout');
  const [collectOpen, setCollectOpen] = useState(false);
  const checkIn = useCheckInKubo();
  const approveEarly = useApproveEarlyCheckIn();
  const guest = useGuest(arrival?.reservation.guest_id);

  const reservation = arrival?.reservation;
  const assignment = arrival?.assignment;
  const balance = toAmount(reservation?.outstanding_balance);
  const ready = isKuboReady(kuboStatus);
  const needsEarlyApproval = Boolean(arrival?.isEarly && !assignment?.early_check_in_approved);
  const pending = checkIn.isPending || approveEarly.isPending;
  const canConfirm = idChecked && detailsConfirmed && keyHanded && ready && !pending;

  const confirm = async () => {
    if (!reservation || !assignment) return;
    try {
      if (needsEarlyApproval) {
        await approveEarly.mutateAsync({ reservationId: reservation.reservation_id, kuboId: assignment.kubo_id });
      }
      await checkIn.mutateAsync({ reservationId: reservation.reservation_id, kuboId: assignment.kubo_id });
      if (payment === 'now' && balance > 0) {
        setCollectOpen(true);
      } else {
        onClose();
      }
    } catch {
      // Server message shown by the mutation toast; keep the drawer open.
    }
  };

  const nights = nightsBetween(assignment?.check_in_date, assignment?.check_out_date);
  const idText = guest.data
    ? `${label(guest.data.valid_id_type)} ${maskId(guest.data.id_number)}`
    : 'Government ID';

  return (
    <>
      <Drawer
        open={Boolean(arrival) && !collectOpen}
        onClose={onClose}
        width={420}
        destroyOnHidden
        title={
          <div>
            <div className={styles.eyebrow}>
              Check in · <span className="mono">{reservation?.reference_code}</span>
            </div>
            <div className={styles.title}>{reservation?.guest_name}</div>
          </div>
        }
        footer={
          <div className={styles.footer}>
            <Button onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="primary" icon={<CheckOutlined />} disabled={!canConfirm} loading={pending} onClick={confirm}>
              {needsEarlyApproval ? 'Approve early & check in' : 'Confirm check-in'}
            </Button>
          </div>
        }
      >
        {assignment && (
          <div className={styles.kuboCard}>
            <div>
              <div className={styles.kuboName}>
                {assignment.kubo_number} · {assignment.type_name}
              </div>
              <div className="muted">
                {formatStayRange(assignment.check_in_date, assignment.check_out_date)} · {pluralize(nights, 'night')}
              </div>
            </div>
            {ready ? <StatusBadge status="Ready" /> : <StatusBadge status={kuboStatus ?? 'Unknown'} />}
          </div>
        )}

        {!ready && (
          <Callout tone="danger" style={{ marginBottom: 16 }}>
            {assignment?.kubo_number} isn't ready ({label(kuboStatus)}). Reassign the guest to another kubo from the
            reservation, or wait until it's available.
          </Callout>
        )}
        {needsEarlyApproval && (
          <Callout tone="warn" style={{ marginBottom: 16 }}>
            This is before the booked check-in date. Confirming approves an early check-in, which is recorded in the
            audit log.
          </Callout>
        )}

        <div className={styles.sectionTitle}>Before handing over the key</div>
        <div className={styles.checklist}>
          <Checkbox checked={idChecked} onChange={(e) => setIdChecked(e.target.checked)}>
            ID checked — {idText}
          </Checkbox>
          <Checkbox checked={detailsConfirmed} onChange={(e) => setDetailsConfirmed(e.target.checked)}>
            Stay dates and kubo confirmed with guest
          </Checkbox>
          <Checkbox checked={keyHanded} onChange={(e) => setKeyHanded(e.target.checked)}>
            Key handed over
          </Checkbox>
        </div>

        <div className={styles.sectionTitle}>Payment</div>
        <div className={styles.balanceRow}>
          <span>Balance due</span>
          <strong className="tabular">{formatMoney(balance)}</strong>
        </div>
        {balance > 0 && (
          <Segmented<PaymentChoice>
            value={payment}
            onChange={setPayment}
            options={[
              { label: 'Collect now', value: 'now' },
              { label: 'Collect at check-out', value: 'checkout' },
            ]}
          />
        )}
        <p className={styles.note}>The balance must be ₱0 before check-out can be completed.</p>
      </Drawer>

      {reservation && (
        <RecordPaymentModal
          open={collectOpen}
          onClose={() => {
            setCollectOpen(false);
            onClose();
          }}
          reservationId={reservation.reservation_id}
          referenceCode={reservation.reference_code}
          outstandingBalance={balance}
          netPaid={toAmount(reservation.net_paid)}
          defaultAmount={balance}
        />
      )}
    </>
  );
};
