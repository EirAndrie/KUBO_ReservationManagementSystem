import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from 'antd';
import { LeftOutlined, PrinterOutlined, RightOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  EmptyState,
  ErrorState,
  KpiStrip,
  ListSkeleton,
  PageHeader,
  ResponsiveTable,
  Section,
  StatusBadge,
  TwoLine,
} from '@/components/common';
import { formatDateTime, formatMoney, label, pluralize, toAmount } from '@/lib/format';
import { resortToday } from '@/lib/time';
import { PAYMENT_METHOD_LABELS } from '@/features/payment';
import type { PaymentMethod } from '@/features/payment';
import { useDailyReport } from '../hooks/use-daily-report.hook';
import type { DailyCollectionRow, DailyDeparture } from '../types/report.types';
import styles from './daily-report.module.css';

const TOTAL_KEY = '__total__';

const DEPARTURE_STATE: Record<DailyDeparture['assignment_status'], string> = {
  Reserved: 'Not checked in',
  CheckedIn: 'Due out',
  CheckedOut: 'Checked out',
};

/** "14:00:00" -> "2:00 PM". */
function formatTime(value: string | null): string {
  return value ? dayjs(`2000-01-01T${value}`).format('h:mm A') : 'No time set';
}

/**
 * Administrator end-of-day report for a resort calendar day (Asia/Manila):
 * collections by payment method, occupancy for that night, and departures with
 * each reservation's outstanding balance. All totals and balances come from
 * the API (`GET /reports/daily`). The date lives in the URL; Print prints just
 * the report.
 */
export const DailyReportPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const today = resortToday();
  const date = params.get('date') || today;
  const isToday = date === today;
  const report = useDailyReport(date);
  const data = report.data;

  const shift = (days: number) => {
    const next = dayjs(date).add(days, 'day').format('YYYY-MM-DD');
    const nextParams = new URLSearchParams(params);
    if (next === today) nextParams.delete('date');
    else nextParams.set('date', next);
    setParams(nextParams, { replace: true });
  };

  const methodLabel = (method: string) =>
    method === TOTAL_KEY ? 'All methods' : (PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? label(method));

  const collectionRows: DailyCollectionRow[] = data
    ? data.collections.byMethod.length > 1
      ? [...data.collections.byMethod, { payment_method: TOTAL_KEY, ...data.collections.totals }]
      : data.collections.byMethod
    : [];

  const collectionColumns: ColumnsType<DailyCollectionRow> = [
    { title: 'Method', render: (_, r) => methodLabel(r.payment_method) },
    {
      title: 'Collected',
      align: 'right',
      render: (_, r) => (
        <TwoLine primary={<span className="tabular">{formatMoney(r.collected)}</span>} secondary={pluralize(r.payments_count, 'payment')} />
      ),
    },
    {
      title: 'Refunded',
      align: 'right',
      render: (_, r) =>
        toAmount(r.refunded) > 0 ? (
          <TwoLine primary={<span className="tabular">−{formatMoney(r.refunded)}</span>} secondary={pluralize(r.refunds_count, 'refund')} />
        ) : (
          <span className="muted">—</span>
        ),
    },
    { title: 'Net', align: 'right', render: (_, r) => <strong className="tabular">{formatMoney(r.net)}</strong> },
    {
      title: 'Pending',
      align: 'right',
      render: (_, r) =>
        r.pending_count > 0 ? (
          <TwoLine primary={<span className="tabular">{formatMoney(r.pending_amount)}</span>} secondary={pluralize(r.pending_count, 'payment')} />
        ) : (
          <span className="muted">—</span>
        ),
    },
  ];

  const departureColumns: ColumnsType<DailyDeparture> = [
    {
      title: 'Guest',
      render: (_, d) => (
        <TwoLine
          primary={d.guest_name}
          secondary={
            <Link to={`/reservations/${d.reservation_id}`} className="mono">
              {d.reference_code}
            </Link>
          }
        />
      ),
    },
    { title: 'Kubo', width: 100, render: (_, d) => <span className="mono">{d.kubo_number}</span> },
    {
      title: 'Check-out',
      width: 190,
      render: (_, d) =>
        d.actual_check_out_datetime ? (
          <TwoLine primary={formatDateTime(d.actual_check_out_datetime)} secondary="Actual" />
        ) : (
          <TwoLine primary={formatTime(d.scheduled_check_out_time)} secondary="Scheduled" />
        ),
    },
    {
      title: 'Status',
      width: 150,
      render: (_, d) => <StatusBadge status={d.assignment_status} text={DEPARTURE_STATE[d.assignment_status]} />,
    },
    {
      title: 'Balance',
      align: 'right',
      width: 130,
      render: (_, d) =>
        toAmount(d.outstanding_balance) > 0 ? (
          <strong className="tabular">{formatMoney(d.outstanding_balance)}</strong>
        ) : (
          <span className="muted">Settled</span>
        ),
    },
  ];

  const occupancy = data?.occupancy;
  const occupancyPct = occupancy && occupancy.total_kubos ? Math.round((occupancy.booked_kubos / occupancy.total_kubos) * 100) : 0;
  const stillDue = data ? data.departures.filter((d) => d.assignment_status !== 'CheckedOut').length : 0;

  return (
    <div>
      <PageHeader
        title="Daily report"
        description={`${dayjs(date).format('dddd, MMMM D, YYYY')} · Resort time (Asia/Manila)`}
        action={
          <div className={styles.actions}>
            <div className={styles.stepper} role="group" aria-label="Choose date">
              <Button icon={<LeftOutlined />} aria-label="Previous day" onClick={() => shift(-1)} />
              <Button onClick={() => shift(dayjs(today).diff(dayjs(date), 'day'))} disabled={isToday}>
                Today
              </Button>
              <Button icon={<RightOutlined />} aria-label="Next day" onClick={() => shift(1)} />
            </div>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()} disabled={!data}>
              Print
            </Button>
          </div>
        }
      />

      {report.isError && !data ? (
        <Section>
          <ErrorState error={report.error} onRetry={() => report.refetch()} />
        </Section>
      ) : (
        <>
          <KpiStrip
            loading={!data}
            items={[
              {
                label: 'Net collected',
                value: data ? formatMoney(data.collections.totals.net) : '—',
                hint: data
                  ? toAmount(data.collections.totals.refunded) > 0
                    ? `${formatMoney(data.collections.totals.collected)} in, ${formatMoney(data.collections.totals.refunded)} refunded`
                    : pluralize(data.collections.totals.payments_count, 'payment')
                  : undefined,
              },
              {
                label: 'Pending payments',
                value: data ? formatMoney(data.collections.totals.pending_amount) : '—',
                hint: data ? `${pluralize(data.collections.totals.pending_count, 'payment')} not yet completed` : undefined,
              },
              {
                label: isToday ? 'Booked tonight' : 'Booked that night',
                value: occupancy ? `${occupancyPct}%` : '—',
                hint: occupancy ? `${occupancy.booked_kubos} of ${occupancy.total_kubos} kubos` : undefined,
              },
              {
                label: 'Arrivals · Departures',
                value: occupancy ? `${occupancy.arrivals} · ${occupancy.departures}` : '—',
                hint: occupancy
                  ? stillDue > 0
                    ? `${stillDue} still to check out`
                    : occupancy.departures > 0
                      ? 'All departures checked out'
                      : 'No departures'
                  : undefined,
              },
            ]}
          />

          <Section title="Collections by payment method" className={styles.section}>
            {!data ? (
              <ListSkeleton rows={3} />
            ) : collectionRows.length === 0 ? (
              <EmptyState title="No payments recorded this day." description="Completed payments and refunds appear here by method." />
            ) : (
              <ResponsiveTable<DailyCollectionRow>
                rowKey="payment_method"
                columns={collectionColumns}
                dataSource={collectionRows}
                rowClassName={(r) => (r.payment_method === TOTAL_KEY ? styles.totalRow : '')}
                pagination={false}
                size="middle"
              />
            )}
            <p className={`muted ${styles.note}`}>
              Counts payments recorded this day that are completed, minus completed refunds. Adjustments and reversals are
              charge corrections, not cash, and are left out.
            </p>
          </Section>

          <Section
            flush
            className={styles.section}
            title={data ? `Departures (${data.departures.length})` : 'Departures'}
          >
            {!data ? (
              <ListSkeleton rows={4} />
            ) : data.departures.length === 0 ? (
              <EmptyState title="No departures this day." />
            ) : (
              <ResponsiveTable<DailyDeparture>
                rowKey={(d) => `${d.reservation_id}:${d.kubo_id}`}
                columns={departureColumns}
                dataSource={data.departures}
                pagination={false}
                size="middle"
              />
            )}
          </Section>
        </>
      )}
    </div>
  );
};
