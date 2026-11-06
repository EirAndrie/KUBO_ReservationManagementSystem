import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App, Button, Input, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  PlusOutlined,
  RollbackOutlined,
  SearchOutlined,
  StopOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/features/auth';
import { ReservationPickerModal, useReservations } from '@/features/reservation';
import type { Reservation } from '@/features/reservation';
import {
  EmptyState,
  ErrorState,
  FilterChip,
  KpiStrip,
  ListSkeleton,
  PageHeader,
  RowMenu,
  Section,
  StatusBadge,
  TabLabel,
  TwoLine,
} from '@/components/common';
import type { RowMenuItem } from '@/components/common';
import { formatDateTime, formatMoney, formatMoneyWhole, formatSignedMoney, label, pluralize, toAmount } from '@/lib/format';
import { resortTime } from '@/lib/time';
import { usePayments, useReservationPayments } from '../hooks/use-payments.hook';
import { useUpdatePaymentStatus } from '../hooks/use-payment-mutations.hook';
import { RecordPaymentModal } from '../components/record-payment-modal.component';
import { RefundModal } from '../components/refund-modal.component';
import { PAYMENT_METHODS } from '../types/payment.types';
import type { Payment, PaymentFilterParams, PaymentMethod, PaymentStatus } from '../types/payment.types';
import styles from './payment-list.module.css';

type Tab = 'all' | 'pending' | 'completed' | 'refunds' | 'failed';
type DateRange = 'today' | 'week' | 'month' | 'all';

const TAB_FILTER: Record<Tab, Partial<PaymentFilterParams>> = {
  all: {},
  pending: { paymentStatus: 'Pending' },
  completed: { paymentStatus: 'Completed' },
  refunds: { transactionType: 'Refund' },
  failed: { paymentStatus: 'Failed' },
};

/** Status changes the backend allows from each status (refund states come from the refund routine). */
const NEXT_STATUSES: Partial<Record<PaymentStatus, PaymentStatus[]>> = {
  Pending: ['Processing', 'Completed', 'Failed', 'Cancelled'],
  Processing: ['Completed', 'Failed', 'Cancelled'],
};

const STATUS_ICONS: Partial<Record<PaymentStatus, React.ReactNode>> = {
  Processing: <SyncOutlined />,
  Completed: <CheckOutlined />,
  Failed: <StopOutlined />,
  Cancelled: <CloseCircleOutlined />,
};

function rangeStart(range: DateRange): string | undefined {
  const now = resortTime(new Date());
  if (range === 'today') return now.startOf('day').toISOString();
  if (range === 'week') return now.subtract(7, 'day').startOf('day').toISOString();
  if (range === 'month') return now.startOf('month').toISOString();
  return undefined;
}

/** Signed cash-flow amount: refunds are negative. */
const signed = (p: Payment) => (p.transaction_type === 'Refund' ? -p.payment_amount : p.payment_amount);

function exportCsv(rows: Payment[], guestOf: (id: string) => string) {
  const header = ['Date', 'Reservation', 'Guest', 'Transaction', 'Type', 'Method', 'Status', 'Amount', 'Recorded by'];
  const lines = rows.map((p) =>
    [
      resortTime(p.payment_date).format('YYYY-MM-DD HH:mm'),
      p.reservation_reference ?? '',
      guestOf(p.reservation_id),
      p.transaction_type,
      label(p.payment_type),
      label(p.payment_method),
      label(p.payment_status),
      signed(p).toFixed(2),
      p.employee_name ?? '',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payments-${dayjs().format('YYYYMMDD')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Payments ledger. One primary action (Record payment) plus Export. KPIs count
 * cash the way the desk does: collected today and this month (completed),
 * pending, and refunded this month. Refunds show as negative amounts.
 * Status changes are offered only where the backend allows them.
 */
export const PaymentListPage: React.FC = () => {
  const navigate = useNavigate();
  const { modal } = App.useApp();
  const { isStaff } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'all';
  const range = (params.get('range') as DateRange) || 'month';
  const method = (params.get('method') as PaymentMethod) || undefined;
  const recordedBy = params.get('by') || undefined;
  const [search, setSearch] = useState('');

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const createdFrom = useMemo(() => rangeStart(range), [range]);
  const list = usePayments({ ...TAB_FILTER[tab], paymentMethod: method, createdFrom, limit: 100 });
  const monthStart = useMemo(() => rangeStart('month'), []);
  const month = usePayments({ createdFrom: monthStart, limit: 100 });
  const pendingAll = usePayments({ paymentStatus: 'Pending', limit: 100 });
  const reservations = useReservations({ limit: 100 });
  const updateStatus = useUpdatePaymentStatus();

  const [picking, setPicking] = useState(false);
  const [recordFor, setRecordFor] = useState<Reservation | null>(null);
  const [refundFor, setRefundFor] = useState<Payment | null>(null);
  const refundPayments = useReservationPayments(refundFor?.reservation_id ?? '');

  const reservationById = useMemo(() => new Map((reservations.data ?? []).map((r) => [r.reservation_id, r])), [reservations.data]);
  const guestOf = (id: string) => reservationById.get(id)?.guest_name ?? '';

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data ?? []).filter((p) => {
      if (recordedBy && p.employee_name !== recordedBy) return false;
      if (!q) return true;
      return [p.reservation_reference ?? '', reservationById.get(p.reservation_id)?.guest_name ?? ''].some((v) => v.toLowerCase().includes(q));
    });
  }, [list.data, search, recordedBy, reservationById]);

  // KPIs (this month / today), from completed rows only.
  const monthRows = month.data ?? [];
  const isCollected = (p: Payment) => p.transaction_type === 'Payment' && ['Completed', 'PartiallyRefunded', 'Refunded'].includes(p.payment_status);
  const todayKey = resortTime(new Date()).format('YYYY-MM-DD');
  const collectedToday = monthRows.filter((p) => isCollected(p) && resortTime(p.payment_date).format('YYYY-MM-DD') === todayKey);
  const collectedMonth = monthRows.filter(isCollected);
  const refundsMonth = monthRows.filter((p) => p.transaction_type === 'Refund' && p.payment_status === 'Completed');
  const pendingRows = pendingAll.data ?? [];
  const sum = (rs: Payment[]) => rs.reduce((s, p) => s + p.payment_amount, 0);

  const recorders = useMemo(() => {
    const names = new Set<string>();
    (list.data ?? []).forEach((p) => p.employee_name && names.add(p.employee_name));
    if (recordedBy) names.add(recordedBy);
    return [...names].sort().map((n) => ({ value: n, label: n }));
  }, [list.data, recordedBy]);

  const menuFor = (p: Payment): RowMenuItem[] => {
    const items: RowMenuItem[] = [
      { key: 'view', label: 'View reservation', icon: <EyeOutlined />, onClick: () => navigate(`/reservations/${p.reservation_id}`) },
    ];
    if (!isStaff) return items;
    (NEXT_STATUSES[p.payment_status] ?? []).forEach((next) =>
      items.push({
        key: next,
        label: `Mark ${label(next).toLowerCase()}`,
        icon: STATUS_ICONS[next],
        danger: next === 'Failed' || next === 'Cancelled',
        onClick: () =>
          modal.confirm({
            title: `Mark ${formatMoney(p.payment_amount)} as ${label(next).toLowerCase()}?`,
            content:
              next === 'Completed'
                ? 'The payment will count toward the reservation balance.'
                : next === 'Processing'
                  ? 'The payment stays out of the balance until it is completed.'
                  : 'The payment won’t count toward the balance. This can’t be undone.',
            okText: `Mark ${label(next).toLowerCase()}`,
            okButtonProps: { danger: next === 'Failed' || next === 'Cancelled' },
            onOk: () => updateStatus.mutateAsync({ paymentId: p.payment_id, status: next }),
          }),
      }),
    );
    if (p.transaction_type === 'Payment' && ['Completed', 'PartiallyRefunded'].includes(p.payment_status)) {
      items.push({ key: 'd', divider: true });
      items.push({ key: 'refund', label: 'Issue refund', icon: <RollbackOutlined />, onClick: () => setRefundFor(p) });
    }
    return items;
  };

  const columns: ColumnsType<Payment> = [
    {
      title: 'Amount',
      align: 'right',
      width: 140,
      render: (_, p) => <span className={`tabular ${styles.amount}`}>{formatSignedMoney(signed(p))}</span>,
    },
    { title: 'Status', width: 160, render: (_, p) => <StatusBadge status={p.payment_status} /> },
    {
      title: 'Reservation',
      render: (_, p) => <TwoLine primary={<span className="mono">{p.reservation_reference ?? '—'}</span>} secondary={guestOf(p.reservation_id) || undefined} />,
    },
    { title: 'Type', render: (_, p) => (p.transaction_type === 'Refund' ? 'Refund' : label(p.payment_type)) },
    { title: 'Method', render: (_, p) => label(p.payment_method) },
    { title: 'Date', width: 160, render: (_, p) => <span className="tabular">{formatDateTime(p.payment_date)}</span> },
    { key: 'menu', width: 48, align: 'center', render: (_, p) => <RowMenu items={menuFor(p)} label="Payment actions" /> },
  ];


  const refundReservation = refundFor ? reservationById.get(refundFor.reservation_id) : undefined;

  const tabs: Array<{ key: Tab; text: string; count?: number }> = [
    { key: 'all', text: 'All', count: tab === 'all' ? list.data?.length : undefined },
    { key: 'pending', text: 'Pending', count: pendingRows.length },
    { key: 'completed', text: 'Completed' },
    { key: 'refunds', text: 'Refunds' },
    { key: 'failed', text: 'Failed' },
  ];

  return (
    <div>
      <PageHeader
        title="Payments"
        action={
          <>
            <Button icon={<DownloadOutlined />} disabled={rows.length === 0} onClick={() => exportCsv(rows, guestOf)}>
              Export
            </Button>
            {isStaff && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setPicking(true)}>
                Record payment
              </Button>
            )}
          </>
        }
      />

      <KpiStrip
        loading={month.isLoading}
        items={[
          { label: 'Collected today', value: formatMoneyWhole(sum(collectedToday)), hint: pluralize(collectedToday.length, 'payment') },
          { label: 'Collected this month', value: formatMoneyWhole(sum(collectedMonth)), hint: pluralize(collectedMonth.length, 'payment') },
          { label: 'Pending', value: formatMoneyWhole(sum(pendingRows)), hint: `${pendingRows.length} awaiting confirmation` },
          { label: 'Refunded this month', value: formatMoneyWhole(sum(refundsMonth)), hint: pluralize(refundsMonth.length, 'refund') },
        ]}
      />

      <Tabs
        activeKey={tab}
        onChange={(k) => set({ tab: k === 'all' ? undefined : k })}
        items={tabs.map((t) => ({ key: t.key, label: <TabLabel text={t.text} count={t.count} active={tab === t.key} /> }))}
      />

      <div className={styles.toolbar}>
        <Input
          allowClear
          prefix={<SearchOutlined className="muted" />}
          placeholder="Search reference or guest"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
          aria-label="Search payments"
        />
        <FilterChip<DateRange>
          name="Date"
          value={range}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'Last 7 days' },
            { value: 'month', label: 'This month' },
            { value: 'all', label: 'All time' },
          ]}
          onChange={(v) => set({ range: v === 'month' ? undefined : (v ?? 'all') })}
        />
        <FilterChip<PaymentMethod>
          name="Method"
          value={method}
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: label(m) }))}
          onChange={(v) => set({ method: v })}
        />
        <FilterChip<string> name="Recorded by" value={recordedBy} options={recorders} onChange={(v) => set({ by: v })} />
      </div>

      <Section flush>
        {list.isLoading ? (
          <ListSkeleton rows={8} />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No payments match" description="Try another tab, date range or method." />
        ) : (
          <Table<Payment>
            rowKey="payment_id"
            columns={columns}
            dataSource={rows}
            size="middle"
            pagination={rows.length > 25 ? { pageSize: 25, showSizeChanger: false } : false}
            rowClassName={() => 'clickable-row'}
            onRow={(p) => ({ onClick: () => navigate(`/reservations/${p.reservation_id}`) })}
          />
        )}
      </Section>

      <ReservationPickerModal
        open={picking}
        title="Record payment"
        reservations={(reservations.data ?? []).filter((r) => ['Pending', 'Confirmed', 'CheckedIn', 'CheckedOut'].includes(r.status) && toAmount(r.outstanding_balance) > 0)}
        onCancel={() => setPicking(false)}
        onPick={(r) => {
          setPicking(false);
          setRecordFor(r);
        }}
      />
      {recordFor && (
        <RecordPaymentModal
          open
          onClose={() => setRecordFor(null)}
          reservationId={recordFor.reservation_id}
          referenceCode={recordFor.reference_code}
          outstandingBalance={toAmount(recordFor.outstanding_balance)}
          netPaid={toAmount(recordFor.net_paid)}
          defaultAmount={toAmount(recordFor.outstanding_balance)}
        />
      )}
      <RefundModal
        open={Boolean(refundFor)}
        onClose={() => setRefundFor(null)}
        payments={refundPayments.data ?? []}
        netPaid={toAmount(refundReservation?.net_paid)}
        originalPaymentId={refundFor?.payment_id}
      />
    </div>
  );
};
