import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { App, Button, Progress, Steps, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined,
  CloseCircleOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  IdcardOutlined,
  LoginOutlined,
  LogoutOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  PrinterOutlined,
  RightOutlined,
  RollbackOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/features/auth';
import { useGuest } from '@/features/guest';
import { useKubos } from '@/features/kubo';
import {
  AddChargeModal,
  PrintInvoiceModal,
  RecordPaymentModal,
  RefundModal,
  useChargeRequests,
  useDeleteCharge,
  useReservationCharges,
  useReservationPayments,
  useWithdrawChargeRequest,
} from '@/features/payment';
import type { AdditionalCharge, InvoiceBillingBreakdown, Payment } from '@/features/payment';
import { CheckInDrawer, useCheckOutKubo } from '@/features/check-in-out';
import type { ArrivalRecord } from '@/features/check-in-out';
import {
  Callout,
  ErrorState,
  ListSkeleton,
  PageHeader,
  RowMenu,
  Section,
  StatusBadge,
  TwoLine,
} from '@/components/common';
import type { RowMenuItem } from '@/components/common';
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatSignedMoney,
  formatStayRange,
  label,
  maskId,
  nightsBetween,
  pluralize,
  toAmount,
} from '@/lib/format';
import { useReservation } from '../hooks/use-reservations.hook';
import { useConfirmReservation, useMarkNoShow } from '../hooks/use-reservation-mutations.hook';
import { CancelReservationModal } from '../components/cancel-reservation-modal.component';
import type { Reservation, ReservationAssignment } from '../types/reservation.types';
import { stayOf } from '../utils/reservation.utils';
import styles from './reservation-detail.module.css';

interface LedgerRow {
  key: string;
  date: string;
  description: string;
  detail: string;
  by?: string;
  status: string;
  statusText?: string;
  /** Effect on the balance: charges add, payments subtract, refunds add back. */
  amount: number;
  counted: boolean;
  charge?: AdditionalCharge;
  payment?: Payment;
}

const COUNTED_PAYMENT_STATUSES = ['Completed', 'PartiallyRefunded', 'Refunded'];

/** Lifecycle stepper; Cancelled and No-show end the line in red. */
function lifecycleSteps(r: Reservation) {
  const firstIn = r.assignments
    .map((a) => a.actual_check_in_datetime)
    .filter(Boolean)
    .sort()[0];
  const lastOut = r.assignments
    .map((a) => a.actual_check_out_datetime)
    .filter(Boolean)
    .sort()
    .reverse()[0];
  const stay = stayOf(r.assignments);
  const booked = { title: 'Booked', description: formatDate(r.reserved_at, 'MMM D') };

  if (r.status === 'Cancelled') {
    return {
      current: 1,
      items: [booked, { title: 'Cancelled', description: formatDate(r.cancelled_at, 'MMM D'), status: 'error' as const }],
    };
  }
  if (r.status === 'NoShow') {
    return {
      current: 2,
      items: [booked, { title: 'Confirmed' }, { title: 'No-show', description: 'Guest did not arrive', status: 'error' as const }],
    };
  }

  const order = ['Pending', 'Confirmed', 'CheckedIn', 'CheckedOut'];
  const reached = order.indexOf(r.status);
  return {
    current: reached,
    items: [
      booked,
      { title: 'Confirmed', description: reached >= 1 ? 'Confirmed' : 'Awaiting confirmation' },
      { title: 'Checked in', description: firstIn ? formatDateTime(firstIn) : formatDate(stay.checkIn, 'MMM D') },
      { title: 'Checked out', description: lastOut ? formatDateTime(lastOut) : formatDate(stay.checkOut, 'MMM D') },
    ].map((item, i) => ({ ...item, status: (i < reached || r.status === 'CheckedOut' ? 'finish' : i === reached ? 'process' : 'wait') as 'finish' | 'process' | 'wait' })),
  };
}

/**
 * Reservation detail: guest name as H1, one status-driven primary action,
 * lifecycle stepper, stay table (rate at booking), a single charges &
 * payments ledger, and a sticky balance card. The balance is always the API's
 * `outstanding_balance`; it is never recomputed here.
 */
export const ReservationDetailPage: React.FC = () => {
  const { reservationId = '' } = useParams<{ reservationId: string }>();
  const { modal } = App.useApp();
  const { isStaff, user } = useAuth();

  const query = useReservation(reservationId);
  const reservation = query.data;
  const payments = useReservationPayments(reservationId);
  const charges = useReservationCharges(reservationId);
  const requests = useChargeRequests({ reservationId }, Boolean(reservationId));
  const guest = useGuest(reservation?.guest_id);
  const kubos = useKubos();

  const confirm = useConfirmReservation();
  const noShow = useMarkNoShow();
  const checkOut = useCheckOutKubo();
  const deleteCharge = useDeleteCharge();
  const withdraw = useWithdrawChargeRequest();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState<{ amount?: number } | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [arrival, setArrival] = useState<ArrivalRecord | null>(null);

  useBreadcrumbLabel(reservation?.reference_code);

  const paymentList = useMemo(() => payments.data ?? [], [payments.data]);
  const chargeList = useMemo(() => charges.data ?? [], [charges.data]);
  const pendingRequests = (requests.data ?? []).filter((r) => r.status === 'Pending');

  const ledger: LedgerRow[] = useMemo(() => {
    const rows: LedgerRow[] = [
      ...chargeList.map((c) => ({
        key: `c-${c.additional_charge_id}`,
        date: c.charge_date,
        description: c.catalog_name || c.description || label(c.charge_type),
        detail: `${label(c.charge_type)}${c.quantity > 1 ? ` · ${c.quantity} × ${formatMoney(c.unit_amount)}` : ''}`,
        by: c.employee_name,
        status: 'Applied',
        amount: c.amount,
        counted: true,
        charge: c,
      })),
      ...paymentList.map((p) => {
        const isRefund = p.transaction_type === 'Refund';
        const counted = isRefund ? p.payment_status === 'Completed' : COUNTED_PAYMENT_STATUSES.includes(p.payment_status);
        return {
          key: `p-${p.payment_id}`,
          date: p.payment_date,
          description: `${label(isRefund ? 'Refund' : p.payment_type)} · ${label(p.payment_method)}`,
          detail: label(p.transaction_type),
          by: p.employee_name,
          status: p.payment_status,
          amount: isRefund ? p.payment_amount : -p.payment_amount,
          counted,
          payment: p,
        };
      }),
    ];
    return rows.sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
  }, [chargeList, paymentList]);

  if (query.isLoading) {
    return <ListSkeleton rows={12} />;
  }
  if (query.isError || !reservation) {
    return (
      <Section>
        <ErrorState error={query.error ?? new Error('Reservation not found.')} onRetry={() => query.refetch()} />
      </Section>
    );
  }

  const stay = stayOf(reservation.assignments);
  const accommodation = toAmount(reservation.accommodation_total);
  const gross = toAmount(reservation.charges_total); // accommodation + applied charges
  const extras = Math.max(0, gross - accommodation);
  const netPaid = toAmount(reservation.net_paid);
  const balance = toAmount(reservation.outstanding_balance);
  const paidPct = gross > 0 ? Math.min(100, Math.round((netPaid / gross) * 100)) : 0;
  const isClosed = ['Cancelled', 'NoShow'].includes(reservation.status);
  const isSettled =
    ['CheckedOut', 'Cancelled', 'NoShow'].includes(reservation.status) ||
    paymentList.some((p) => p.payment_status === 'Completed' || p.payment_status === 'PartiallyRefunded' || p.payment_status === 'Refunded');
  const kuboStatus = (kuboId: string) => kubos.data?.find((k) => k.kuboId === kuboId)?.status;
  const firstReserved = reservation.assignments.find((a) => a.status === 'Reserved');
  const checkedInAssignments = reservation.assignments.filter((a) => a.status === 'CheckedIn');

  const openCheckIn = (a: ReservationAssignment) =>
    setArrival({
      reservation,
      assignment: a,
      isEarly: dayjs(a.check_in_date).isAfter(dayjs(), 'day'),
      canCheckIn: true,
    });

  const doCheckOut = () =>
    modal.confirm({
      title: `Check out ${reservation.guest_name}?`,
      content: `${pluralize(checkedInAssignments.length, 'kubo')} will be checked out and marked for cleaning.`,
      okText: 'Check out',
      onOk: async () => {
        for (const a of checkedInAssignments) {
          await checkOut.mutateAsync({ reservationId, kuboId: a.kubo_id });
        }
      },
    });

  // One primary action, chosen by status (Staff only; lifecycle is a Staff action).
  let primary: React.ReactNode = null;
  if (isStaff) {
    if (reservation.status === 'Pending') {
      primary = (
        <Button type="primary" icon={<CheckOutlined />} loading={confirm.isPending} onClick={() => confirm.mutate(reservationId)}>
          Confirm
        </Button>
      );
    } else if (reservation.status === 'Confirmed' || (reservation.status === 'CheckedIn' && firstReserved && checkedInAssignments.length === 0)) {
      primary = firstReserved ? (
        <Button type="primary" icon={<LoginOutlined />} onClick={() => openCheckIn(firstReserved)}>
          Check in
        </Button>
      ) : null;
    } else if (reservation.status === 'CheckedIn') {
      primary = (
        <Tooltip title={balance > 0 ? `Collect ${formatMoney(balance)} before checking out.` : undefined}>
          <Button type="primary" icon={<LogoutOutlined />} disabled={balance > 0 || checkedInAssignments.length === 0} loading={checkOut.isPending} onClick={doCheckOut}>
            Check out
          </Button>
        </Tooltip>
      );
    }
  }

  const menu: RowMenuItem[] = [];
  if (isStaff) {
    if (!isClosed && reservation.status !== 'CheckedOut') {
      menu.push({ key: 'charge', label: 'Add charge', icon: <PlusOutlined />, onClick: () => setChargeOpen(true) });
    }
    if (netPaid > 0) {
      menu.push({ key: 'refund', label: 'Issue refund', icon: <RollbackOutlined />, onClick: () => setRefundOpen(true) });
    }
    if (reservation.status === 'Confirmed') {
      menu.push({
        key: 'noshow',
        label: 'Mark no-show',
        icon: <StopOutlined />,
        onClick: () =>
          modal.confirm({
            title: `Mark ${reservation.reference_code} as no-show?`,
            content: 'The booking ends and its kubos are released. This can’t be undone.',
            okText: 'Mark no-show',
            okButtonProps: { danger: true },
            onOk: () => noShow.mutateAsync(reservationId),
          }),
      });
    }
    if (reservation.status === 'Pending' || reservation.status === 'Confirmed') {
      menu.push({ key: 'd', divider: true });
      menu.push({ key: 'cancel', label: 'Cancel reservation', icon: <CloseCircleOutlined />, danger: true, onClick: () => setCancelOpen(true) });
    }
  }

  const invoice: InvoiceBillingBreakdown = {
    reservationId,
    referenceCode: reservation.reference_code,
    guestName: reservation.guest_name,
    guestEmail: guest.data?.email,
    guestPhone: guest.data?.phone,
    status: label(reservation.status),
    checkInDate: stay.checkIn ?? '',
    checkOutDate: stay.checkOut ?? '',
    assignments: reservation.assignments.map((a) => {
      const nights = nightsBetween(a.check_in_date, a.check_out_date);
      return {
        kuboNumber: a.kubo_number ?? '',
        typeName: a.type_name ?? '',
        nights,
        pricePerNight: toAmount(a.price_at_booking),
        total: nights * toAmount(a.price_at_booking),
      };
    }),
    additionalCharges: chargeList.map((c) => ({
      chargeId: c.additional_charge_id,
      chargeType: c.charge_type,
      description: c.catalog_name || c.description,
      amount: c.amount,
      date: c.charge_date,
    })),
    payments: paymentList.map((p) => ({
      paymentId: p.payment_id,
      date: p.payment_date,
      transactionType: p.transaction_type,
      method: p.payment_method,
      type: p.payment_type,
      amount: p.payment_amount,
      status: p.payment_status,
    })),
    accommodationTotal: accommodation,
    chargesTotal: extras,
    grossBilled: gross,
    netPaid,
    outstandingBalance: balance,
    isSettled: balance <= 0,
  };

  const stayColumns: ColumnsType<ReservationAssignment> = [
    {
      title: 'Kubo',
      render: (_, a) => <TwoLine primary={a.kubo_number} secondary={`${a.type_name ?? ''}${a.capacity ? ` · up to ${a.capacity}` : ''}`} />,
    },
    {
      title: 'Dates',
      render: (_, a) => (
        <span className="tabular">
          {formatStayRange(a.check_in_date, a.check_out_date)} · {pluralize(nightsBetween(a.check_in_date, a.check_out_date), 'night')}
        </span>
      ),
    },
    { title: 'Status', render: (_, a) => <StatusBadge status={a.status ?? 'Reserved'} /> },
    {
      title: 'Rate at booking',
      align: 'right',
      render: (_, a) => <span className="tabular">{formatMoney(a.price_at_booking)} / night</span>,
    },
    {
      title: 'Subtotal',
      align: 'right',
      render: (_, a) => (
        <span className="tabular">{formatMoney(nightsBetween(a.check_in_date, a.check_out_date) * toAmount(a.price_at_booking))}</span>
      ),
    },
    ...(isStaff
      ? [
          {
            key: 'menu',
            width: 48,
            render: (_: unknown, a: ReservationAssignment) =>
              a.status === 'Reserved' && ['Confirmed', 'CheckedIn'].includes(reservation.status) ? (
                <RowMenu
                  label={`Actions for ${a.kubo_number}`}
                  items={[{ key: 'in', label: 'Check in this kubo', icon: <LoginOutlined />, onClick: () => openCheckIn(a) }]}
                />
              ) : null,
          },
        ]
      : []),
  ];

  const ledgerColumns: ColumnsType<LedgerRow> = [
    { title: 'Date', width: 90, render: (_, r) => <span className="tabular">{formatDate(r.date, 'MMM D')}</span> },
    { title: 'Description', render: (_, r) => <TwoLine primary={r.description} secondary={r.detail} /> },
    { title: 'By', render: (_, r) => <span className="muted">{r.by ?? '—'}</span> },
    { title: 'Status', render: (_, r) => <StatusBadge status={r.status} /> },
    {
      title: 'Amount',
      align: 'right',
      render: (_, r) => (
        <span
          className={`tabular ${!r.counted ? styles.notCounted : r.amount < 0 ? styles.credit : ''}`}
          title={!r.counted ? 'Not counted in the balance' : undefined}
        >
          {formatSignedMoney(r.amount)}
        </span>
      ),
    },
    ...(isStaff && !isSettled
      ? [
          {
            key: 'menu',
            width: 48,
            render: (_: unknown, r: LedgerRow) =>
              r.charge ? (
                <RowMenu
                  label="Charge actions"
                  items={[
                    {
                      key: 'del',
                      label: 'Remove charge',
                      icon: <DeleteOutlined />,
                      danger: true,
                      onClick: () =>
                        modal.confirm({
                          title: 'Remove this charge?',
                          content: `${r.description} (${formatMoney(r.amount)}) will be removed from the bill.`,
                          okText: 'Remove',
                          okButtonProps: { danger: true },
                          onOk: () => deleteCharge.mutateAsync(r.charge!.additional_charge_id),
                        }),
                    },
                  ]}
                />
              ) : null,
          },
        ]
      : []),
  ];

  const steps = lifecycleSteps(reservation);
  const summary = [
    reservation.reference_code,
    reservation.assignments.map((a) => `${a.kubo_number} ${a.type_name ?? ''}`.trim()).join(', '),
    stay.checkIn ? `${formatDate(stay.checkIn, 'MMM D')} → ${formatDate(stay.checkOut, 'MMM D')} (${pluralize(stay.nights, 'night')})` : null,
    `Booked ${label(reservation.booking_source).toLowerCase()} by ${reservation.employee_name}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div>
      <PageHeader
        title={reservation.guest_name}
        titleExtra={<StatusBadge status={reservation.status} />}
        description={summary}
        action={
          <>
            <Button icon={<PrinterOutlined />} onClick={() => setInvoiceOpen(true)}>
              Invoice
            </Button>
            {menu.length > 0 && <RowMenu items={menu} label="More reservation actions" />}
            {primary}
          </>
        }
      />

      <Section style={{ marginBottom: 20 }}>
        <Steps size="small" current={steps.current} items={steps.items} />
        {reservation.status === 'Cancelled' && reservation.cancellation_reason && (
          <p className="muted" style={{ margin: '12px 0 0' }}>
            Reason: {reservation.cancellation_reason}
          </p>
        )}
      </Section>

      <div className={styles.grid}>
        <div className={styles.mainCol}>
          <Section title="Stay" flush>
            <Table<ReservationAssignment>
              rowKey={(a) => a.reserved_kubo_id ?? a.kubo_id}
              columns={stayColumns}
              dataSource={reservation.assignments}
              pagination={false}
              size="middle"
            />
          </Section>

          <Section
            title="Charges & payments"
            flush
            extra={
              isStaff && !isClosed ? (
                <>
                  {reservation.status !== 'CheckedOut' && (
                    <Button size="small" icon={<PlusOutlined />} onClick={() => setChargeOpen(true)}>
                      Add charge
                    </Button>
                  )}
                  {balance > 0 && (
                    <Button size="small" icon={<CreditCardOutlined />} onClick={() => setPaymentOpen({})}>
                      Record payment
                    </Button>
                  )}
                </>
              ) : null
            }
          >
            {payments.isError || charges.isError ? (
              <ErrorState
                error={payments.error ?? charges.error}
                onRetry={() => {
                  payments.refetch();
                  charges.refetch();
                }}
              />
            ) : payments.isLoading || charges.isLoading ? (
              <ListSkeleton rows={3} />
            ) : (
              <Table<LedgerRow>
                rowKey="key"
                columns={ledgerColumns}
                dataSource={ledger}
                pagination={false}
                size="middle"
                locale={{ emptyText: 'No charges or payments yet.' }}
              />
            )}
          </Section>

          {pendingRequests.length > 0 && (
            <Section title="Awaiting approval · not billed yet" flush>
              <ul className={styles.requestList}>
                {pendingRequests.map((req) => (
                  <li key={req.request_id} className={styles.requestRow}>
                    <TwoLine
                      primary={req.description}
                      secondary={`Requested by ${req.requested_by_name} · ${formatDateTime(req.created_at)}`}
                    />
                    <span className={`tabular ${styles.notCounted}`}>
                      {formatMoney(req.quantity * req.proposed_unit_amount)}
                    </span>
                    {isStaff && req.requested_by === user?.employeeId ? (
                      <Button size="small" loading={withdraw.isPending} onClick={() => withdraw.mutate(req.request_id)}>
                        Withdraw
                      </Button>
                    ) : (
                      <StatusBadge status="Pending" />
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <aside className={styles.sideCol}>
          <Section className={styles.sticky}>
            <div className="muted">Balance due</div>
            <div className={styles.balance}>{isClosed ? '—' : formatMoney(balance)}</div>
            <dl className={styles.breakdown}>
              <dt>Accommodation</dt>
              <dd className="tabular">{formatMoney(accommodation)}</dd>
              <dt>Charges</dt>
              <dd className="tabular">{formatMoney(extras)}</dd>
              <dt>Paid</dt>
              <dd className={`tabular ${styles.credit}`}>{formatSignedMoney(-netPaid)}</dd>
            </dl>
            <Progress percent={paidPct} showInfo={false} size="small" aria-label={`${paidPct}% paid`} />
            <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
              {paidPct}% paid
            </div>
            {isStaff && balance > 0 && !isClosed && (
              <Button type={primary ? 'default' : 'primary'} block onClick={() => setPaymentOpen({ amount: balance })}>
                Collect {formatMoney(balance)}
              </Button>
            )}
            {reservation.status === 'CheckedIn' && balance > 0 && (
              <Callout tone="warn" style={{ marginTop: 12 }}>
                Check-out unlocks when the balance reaches ₱0.
              </Callout>
            )}
          </Section>

          <Section
            title="Guest"
            extra={
              <Link to={`/guests/${reservation.guest_id}`} className={styles.profileLink}>
                Profile <RightOutlined />
              </Link>
            }
          >
            {guest.data ? (
              <ul className={styles.contactList}>
                <li>
                  <MailOutlined className="muted" /> {guest.data.email}
                </li>
                <li>
                  <PhoneOutlined className="muted" /> {guest.data.phone}
                </li>
                <li>
                  <IdcardOutlined className="muted" /> {label(guest.data.valid_id_type)} · {maskId(guest.data.id_number)}
                </li>
              </ul>
            ) : (
              <span className="muted">{guest.isLoading ? 'Loading…' : 'Guest details unavailable.'}</span>
            )}
          </Section>
        </aside>
      </div>

      <CancelReservationModal reservation={cancelOpen ? reservation : null} onClose={() => setCancelOpen(false)} />
      <AddChargeModal open={chargeOpen} onClose={() => setChargeOpen(false)} reservationId={reservationId} />
      <RecordPaymentModal
        open={Boolean(paymentOpen)}
        onClose={() => setPaymentOpen(null)}
        reservationId={reservationId}
        referenceCode={reservation.reference_code}
        outstandingBalance={balance}
        netPaid={netPaid}
        defaultAmount={paymentOpen?.amount}
      />
      <RefundModal open={refundOpen} onClose={() => setRefundOpen(false)} payments={paymentList} netPaid={netPaid} />
      <PrintInvoiceModal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} invoice={invoice} />
      <CheckInDrawer
        arrival={arrival}
        kuboStatus={arrival ? kuboStatus(arrival.assignment.kubo_id) : undefined}
        onClose={() => setArrival(null)}
      />
    </div>
  );
};
