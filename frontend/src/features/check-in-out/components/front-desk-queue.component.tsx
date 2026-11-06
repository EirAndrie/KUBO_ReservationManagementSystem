import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Table, Tabs, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ExclamationCircleOutlined, LoginOutlined, LogoutOutlined } from '@ant-design/icons';
import { useKubos } from '@/features/kubo';
import { RecordPaymentModal } from '@/features/payment';
import type { Reservation, ReservationAssignment } from '@/features/reservation';
import { Avatar, Callout, EmptyState, ErrorState, ListSkeleton, StatusBadge, TabLabel, TwoLine } from '@/components/common';
import { formatDate, formatMoney, formatStayRange, label, nightsBetween, pluralize, toAmount } from '@/lib/format';
import { useCheckInOutQueue } from '../hooks/use-check-in-out.hook';
import { useCheckOutKubo } from '../hooks/use-check-in-out-mutations.hook';
import { CheckInDrawer } from './check-in-drawer.component';
import { isKuboReady } from '../utils/kubo-readiness';
import type { ArrivalRecord } from '../types/check-in-out.types';
import styles from './front-desk-queue.module.css';

export type QueueTab = 'arrivals' | 'departures' | 'inhouse';

interface QueueRow {
  key: string;
  reservation: Reservation;
  assignment: ReservationAssignment;
  balance: number;
  arrival?: ArrivalRecord;
}

export interface FrontDeskQueueProps {
  date: string;
  tab: QueueTab;
  onTabChange: (tab: QueueTab) => void;
  /** Extra content on the right of the tab bar (e.g. "Open desk ›"). */
  tabBarExtra?: React.ReactNode;
}

function scheduledTime(value?: string | null): string {
  if (!value) return 'Any time';
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h)) return value;
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${suffix}`;
}

/**
 * Arrivals / Departures / In-house for one operational date, with inline
 * Check in (side drawer with checklist) and Check out (blocked while a
 * balance is due, with a Collect shortcut). Mutations invalidate the queue
 * and kubo queries, so rows move between tabs without a page reload.
 */
export const FrontDeskQueue: React.FC<FrontDeskQueueProps> = ({ date, tab, onTabChange, tabBarExtra }) => {
  const navigate = useNavigate();
  const { modal } = App.useApp();
  const queue = useCheckInOutQueue(date);
  const kubos = useKubos();
  const checkOut = useCheckOutKubo();
  const [arrival, setArrival] = useState<ArrivalRecord | null>(null);
  const [collectFor, setCollectFor] = useState<Reservation | null>(null);

  const kuboStatus = useMemo(() => {
    const map = new Map<string, string>();
    (kubos.data ?? []).forEach((k) => map.set(k.kuboId, k.status));
    return map;
  }, [kubos.data]);

  const rows: Record<QueueTab, QueueRow[]> = {
    arrivals: queue.arrivals.map((a) => ({
      key: `${a.reservation.reservation_id}:${a.assignment.kubo_id}`,
      reservation: a.reservation,
      assignment: a.assignment,
      balance: toAmount(a.reservation.outstanding_balance),
      arrival: a,
    })),
    departures: queue.departures.map((d) => ({
      key: `${d.reservation.reservation_id}:${d.assignment.kubo_id}`,
      reservation: d.reservation,
      assignment: d.assignment,
      balance: d.outstandingBalance,
    })),
    inhouse: queue.inHouse.map((h) => ({
      key: `${h.reservation.reservation_id}:${h.assignment.kubo_id}`,
      reservation: h.reservation,
      assignment: h.assignment,
      balance: h.outstandingBalance,
    })),
  };

  const notReady = rows.arrivals.filter((r) => !isKuboReady(kuboStatus.get(r.assignment.kubo_id)));

  const guestColumn = {
    title: 'Guest',
    render: (_: unknown, r: QueueRow) => (
      <span className={styles.person}>
        <Avatar name={r.reservation.guest_name} />
        <TwoLine
          primary={r.reservation.guest_name}
          secondary={
            <>
              <span className="mono">{r.reservation.reference_code}</span> ·{' '}
              {pluralize(nightsBetween(r.assignment.check_in_date, r.assignment.check_out_date), 'night')}
            </>
          }
        />
      </span>
    ),
  };
  const kuboColumn = {
    title: 'Kubo',
    render: (_: unknown, r: QueueRow) => <TwoLine primary={r.assignment.kubo_number} secondary={r.assignment.type_name} />,
  };
  const balanceColumn = {
    title: 'Balance',
    align: 'right' as const,
    render: (_: unknown, r: QueueRow) => <span className="tabular">{formatMoney(r.balance)}</span>,
  };

  const arrivalColumns: ColumnsType<QueueRow> = [
    guestColumn,
    kuboColumn,
    {
      title: 'Kubo ready?',
      render: (_, r) => {
        const status = kuboStatus.get(r.assignment.kubo_id);
        return isKuboReady(status) ? <StatusBadge status="Ready" /> : <StatusBadge status={status ?? 'Unknown'} />;
      },
    },
    {
      title: 'Expected',
      render: (_, r) => (
        <TwoLine
          primary={scheduledTime(r.assignment.scheduled_check_in_time)}
          secondary={r.arrival?.isEarly ? `Early · booked ${formatDate(r.assignment.check_in_date, 'MMM D')}` : formatDate(r.assignment.check_in_date, 'MMM D')}
        />
      ),
    },
    balanceColumn,
    {
      key: 'action',
      align: 'right',
      width: 120,
      render: (_, r) => {
        const ready = isKuboReady(kuboStatus.get(r.assignment.kubo_id));
        return (
          <Tooltip title={ready ? undefined : `${r.assignment.kubo_number} isn't ready for check-in.`}>
            <Button
              size="small"
              type={ready ? 'primary' : 'default'}
              disabled={!ready}
              icon={<LoginOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                if (r.arrival) setArrival(r.arrival);
              }}
            >
              Check in
            </Button>
          </Tooltip>
        );
      },
    },
  ];

  const departureColumns: ColumnsType<QueueRow> = [
    guestColumn,
    kuboColumn,
    { title: 'Due out', render: (_, r) => <span className="tabular">{formatDate(r.assignment.check_out_date, 'MMM D')}</span> },
    balanceColumn,
    {
      key: 'action',
      align: 'right',
      width: 200,
      render: (_, r) => (
        <span className={styles.actions} onClick={(e) => e.stopPropagation()}>
          {r.balance > 0 && (
            <Button size="small" type="link" onClick={() => setCollectFor(r.reservation)}>
              Collect {formatMoney(r.balance)}
            </Button>
          )}
          <Tooltip title={r.balance > 0 ? 'The balance must be ₱0 before check-out.' : undefined}>
            <Button
              size="small"
              icon={<LogoutOutlined />}
              disabled={r.balance > 0}
              loading={checkOut.isPending && checkOut.variables?.kuboId === r.assignment.kubo_id}
              onClick={() =>
                modal.confirm({
                  title: `Check out ${r.reservation.guest_name}?`,
                  content: `${r.assignment.kubo_number} will be marked for cleaning.`,
                  okText: 'Check out',
                  onOk: () =>
                    checkOut.mutateAsync({ reservationId: r.reservation.reservation_id, kuboId: r.assignment.kubo_id }),
                })
              }
            >
              Check out
            </Button>
          </Tooltip>
        </span>
      ),
    },
  ];

  const inHouseColumns: ColumnsType<QueueRow> = [
    guestColumn,
    kuboColumn,
    {
      title: 'Stay',
      render: (_, r) => <span className="tabular">{formatStayRange(r.assignment.check_in_date, r.assignment.check_out_date)}</span>,
    },
    { title: 'Status', render: (_, r) => <StatusBadge status={r.assignment.status ?? 'CheckedIn'} /> },
    balanceColumn,
  ];

  const empty: Record<QueueTab, string> = {
    arrivals: 'No arrivals for this date',
    departures: 'No departures for this date',
    inhouse: 'No guests in-house',
  };

  const renderTable = (key: QueueTab, columns: ColumnsType<QueueRow>) => {
    if (queue.isLoading) return <ListSkeleton rows={4} />;
    if (queue.isError) return <ErrorState error={queue.error} onRetry={() => queue.refetch()} />;
    if (rows[key].length === 0) return <EmptyState title={empty[key]} description="New bookings appear here automatically." />;
    return (
      <Table<QueueRow>
        rowKey="key"
        columns={columns}
        dataSource={rows[key]}
        pagination={false}
        size="middle"
        rowClassName={() => 'clickable-row'}
        onRow={(r) => ({ onClick: () => navigate(`/reservations/${r.reservation.reservation_id}`) })}
      />
    );
  };

  return (
    <>
      <Tabs
        className={styles.tabs}
        activeKey={tab}
        onChange={(k) => onTabChange(k as QueueTab)}
        tabBarExtraContent={tabBarExtra}
        items={[
          {
            key: 'arrivals',
            label: <TabLabel text="Arrivals" count={rows.arrivals.length} active={tab === 'arrivals'} />,
            children: (
              <>
                {renderTable('arrivals', arrivalColumns)}
                {notReady.length > 0 && (
                  <div className={styles.banner}>
                    <Callout tone="warn" icon={<ExclamationCircleOutlined />}>
                      {notReady.map((r) => (
                        <div key={r.key}>
                          <strong>{r.assignment.kubo_number} isn't ready</strong> ({label(kuboStatus.get(r.assignment.kubo_id))}).
                          Move {r.reservation.guest_name} to another {r.assignment.type_name ?? 'kubo'} or ask maintenance for an
                          ETA.
                        </div>
                      ))}
                    </Callout>
                  </div>
                )}
              </>
            ),
          },
          {
            key: 'departures',
            label: <TabLabel text="Departures" count={rows.departures.length} active={tab === 'departures'} />,
            children: renderTable('departures', departureColumns),
          },
          {
            key: 'inhouse',
            label: <TabLabel text="In-house" count={rows.inhouse.length} active={tab === 'inhouse'} />,
            children: renderTable('inhouse', inHouseColumns),
          },
        ]}
      />

      <CheckInDrawer
        arrival={arrival}
        kuboStatus={arrival ? kuboStatus.get(arrival.assignment.kubo_id) : undefined}
        onClose={() => setArrival(null)}
      />
      {collectFor && (
        <RecordPaymentModal
          open
          onClose={() => setCollectFor(null)}
          reservationId={collectFor.reservation_id}
          referenceCode={collectFor.reference_code}
          outstandingBalance={toAmount(collectFor.outstanding_balance)}
          netPaid={toAmount(collectFor.net_paid)}
          defaultAmount={toAmount(collectFor.outstanding_balance)}
        />
      )}
    </>
  );
};
