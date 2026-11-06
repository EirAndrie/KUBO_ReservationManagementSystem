import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App, Button, DatePicker, Input, Select, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import {
  CheckOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  LeftOutlined,
  RightOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/features/auth';
import { useReservations } from '../hooks/use-reservations.hook';
import { useConfirmReservation, useMarkNoShow } from '../hooks/use-reservation-mutations.hook';
import { CancelReservationModal } from '../components/cancel-reservation-modal.component';
import { BOOKING_SOURCE_OPTIONS, STATUS_OPTIONS } from '../constants/reservation.constants';
import type { BookingSource, Reservation, ReservationFilterParams, ReservationStatus } from '../types/reservation.types';
import { balanceOf, stayOf } from '../utils/reservation.utils';
import {
  EmptyState,
  ErrorState,
  FilterChip,
  ListSkeleton,
  PageHeader,
  RowMenu,
  Section,
  StatusBadge,
  TabLabel,
  TwoLine,
} from '@/components/common';
import type { RowMenuItem } from '@/components/common';
import { useDebouncedValue } from '@/hooks/use-debounced-value.hook';
import { formatMoney, formatStayRange, label, pluralize } from '@/lib/format';
import styles from './reservation-list.module.css';

const PAGE_SIZE = 25;

type ViewTab = 'all' | 'arriving' | 'inhouse' | 'pending' | 'upcoming' | 'past';

const TAB_PARAMS: Record<ViewTab, Partial<ReservationFilterParams>> = {
  all: {},
  arriving: { status: 'Confirmed' },
  inhouse: { status: 'CheckedIn' },
  pending: { status: 'Pending' },
  upcoming: { status: 'Confirmed' },
  past: { status: 'CheckedOut' },
};

type SortKey = 'booked' | 'checkin';

/** Builds a CSV from the visible rows (client-side export, no new endpoint). */
function exportCsv(rows: Reservation[]) {
  const header = ['Reference', 'Guest', 'Kubos', 'Check-in', 'Check-out', 'Nights', 'Status', 'Source', 'Balance due'];
  const lines = rows.map((r) => {
    const stay = stayOf(r.assignments);
    return [
      r.reference_code,
      r.guest_name,
      (r.assignments ?? []).map((a) => a.kubo_number).join(' '),
      stay.checkIn ?? '',
      stay.checkOut ?? '',
      String(stay.nights),
      label(r.status),
      label(r.booking_source),
      balanceOf(r).toFixed(2),
    ]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',');
  });
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reservations-${dayjs().format('YYYYMMDD')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Reservations list. Saved-view tabs and filter chips map onto the existing
 * query params (`status`, `bookingSource`, `search`, `checkInDate`,
 * `checkOutDate`, `limit`, `offset`) and are mirrored in the URL so a refresh
 * keeps them. Rare and destructive actions live in the `⋯` menu.
 */
export const ReservationListPage: React.FC = () => {
  const navigate = useNavigate();
  const { modal } = App.useApp();
  const { isStaff } = useAuth();
  const [params, setParams] = useSearchParams();

  const tab = (params.get('tab') as ViewTab) || 'all';
  const statusParam = (params.get('status') as ReservationStatus) || undefined;
  const source = (params.get('source') as BookingSource) || undefined;
  const from = params.get('from') || undefined;
  const to = params.get('to') || undefined;
  const kuboType = params.get('type') || undefined;
  const sort = (params.get('sort') as SortKey) || 'booked';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const searchInput = params.get('search') ?? '';
  const search = useDebouncedValue(searchInput.trim(), 300);

  const update = (patch: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  };

  const today = dayjs().format('YYYY-MM-DD');
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');

  const query: ReservationFilterParams = useMemo(() => {
    const base: ReservationFilterParams = {
      ...TAB_PARAMS[tab],
      search: search || undefined,
      bookingSource: source,
      checkInDate: from,
      checkOutDate: to,
      limit: PAGE_SIZE + 1,
      offset: (page - 1) * PAGE_SIZE,
    };
    if (tab === 'all' && statusParam) base.status = statusParam;
    if (tab === 'arriving') base.checkInDate = today;
    if (tab === 'upcoming') base.checkInDate = from && from > tomorrow ? from : tomorrow;
    return base;
  }, [tab, statusParam, search, source, from, to, page, today, tomorrow]);

  const list = useReservations(query);

  // Tab counts: one request per status bucket the counts need.
  const pendingCount = useReservations({ status: 'Pending', limit: 100 });
  const confirmedCount = useReservations({ status: 'Confirmed', limit: 100 });
  const inHouseCount = useReservations({ status: 'CheckedIn', limit: 100 });
  const arrivingToday = (confirmedCount.data ?? []).filter((r) =>
    (r.assignments ?? []).some((a) => a.check_in_date === today),
  ).length;

  const confirm = useConfirmReservation();
  const noShow = useMarkNoShow();
  const [cancelling, setCancelling] = useState<Reservation | null>(null);

  const rows = useMemo(() => {
    let data = (list.data ?? []).slice(0, PAGE_SIZE);
    if (tab === 'arriving') data = data.filter((r) => (r.assignments ?? []).some((a) => a.check_in_date === today));
    if (kuboType) data = data.filter((r) => (r.assignments ?? []).some((a) => a.type_name === kuboType));
    if (sort === 'checkin') {
      data = [...data].sort((a, b) => (stayOf(a.assignments).checkIn ?? '').localeCompare(stayOf(b.assignments).checkIn ?? ''));
    }
    return data;
  }, [list.data, tab, today, kuboType, sort]);

  const hasNext = (list.data?.length ?? 0) > PAGE_SIZE;
  const typeOptions = useMemo(() => {
    const names = new Set<string>();
    [...(list.data ?? []), ...(confirmedCount.data ?? [])].forEach((r) =>
      (r.assignments ?? []).forEach((a) => a.type_name && names.add(a.type_name)),
    );
    return [...names].sort().map((n) => ({ value: n, label: n }));
  }, [list.data, confirmedCount.data]);

  const askConfirm = (r: Reservation) =>
    modal.confirm({
      title: `Confirm ${r.reference_code}?`,
      content: `${r.guest_name}'s booking moves from Pending to Confirmed.`,
      okText: 'Confirm reservation',
      onOk: () => confirm.mutateAsync(r.reservation_id),
    });

  const askNoShow = (r: Reservation) =>
    modal.confirm({
      title: `Mark ${r.reference_code} as no-show?`,
      content: `${r.guest_name} didn't arrive. The booking ends and its kubos are released. This can't be undone.`,
      okText: 'Mark no-show',
      okButtonProps: { danger: true },
      onOk: () => noShow.mutateAsync(r.reservation_id),
    });

  const menuFor = (r: Reservation): RowMenuItem[] => {
    const items: RowMenuItem[] = [
      { key: 'view', label: 'View', icon: <EyeOutlined />, onClick: () => navigate(`/reservations/${r.reservation_id}`) },
    ];
    if (!isStaff) return items;
    if (r.status === 'Pending') {
      items.push({ key: 'confirm', label: 'Confirm', icon: <CheckOutlined />, onClick: () => askConfirm(r) });
    }
    if (r.status === 'Confirmed') {
      items.push({ key: 'noshow', label: 'Mark no-show', icon: <StopOutlined />, onClick: () => askNoShow(r) });
    }
    if (r.status === 'Pending' || r.status === 'Confirmed') {
      items.push({ key: 'd', divider: true });
      items.push({ key: 'cancel', label: 'Cancel reservation', icon: <CloseCircleOutlined />, danger: true, onClick: () => setCancelling(r) });
    }
    return items;
  };

  const columns: ColumnsType<Reservation> = [
    {
      title: 'Reference',
      dataIndex: 'reference_code',
      width: 190,
      render: (v: string) => <span className={`mono ${styles.ref}`}>{v}</span>,
    },
    { title: 'Guest', dataIndex: 'guest_name', ellipsis: true },
    {
      title: 'Kubo',
      width: 170,
      render: (_, r) => {
        const [first, ...rest] = r.assignments ?? [];
        if (!first) return <span className="muted">—</span>;
        return (
          <TwoLine
            primary={`${first.kubo_number ?? 'Kubo'}${rest.length ? ` +${rest.length}` : ''}`}
            secondary={first.type_name}
          />
        );
      },
    },
    {
      title: 'Stay',
      width: 150,
      render: (_, r) => {
        const s = stayOf(r.assignments);
        return <TwoLine primary={<span className="tabular">{formatStayRange(s.checkIn, s.checkOut)}</span>} secondary={pluralize(s.nights, 'night')} />;
      },
    },
    { title: 'Status', dataIndex: 'status', width: 130, render: (v: ReservationStatus) => <StatusBadge status={v} /> },
    {
      title: 'Balance due',
      align: 'right',
      width: 130,
      render: (_, r) =>
        r.status === 'Cancelled' || r.status === 'NoShow' ? (
          <span className="muted">—</span>
        ) : (
          <span className="tabular">{formatMoney(balanceOf(r))}</span>
        ),
    },
    {
      key: 'actions',
      width: 48,
      align: 'center',
      render: (_, r) => <RowMenu items={menuFor(r)} label={`Actions for ${r.reference_code}`} />,
    },
  ];

  const tabs: Array<{ key: ViewTab; text: string; count?: number }> = [
    { key: 'all', text: 'All' },
    { key: 'arriving', text: 'Arriving today', count: confirmedCount.isSuccess ? arrivingToday : undefined },
    { key: 'inhouse', text: 'In-house', count: inHouseCount.data?.length },
    { key: 'pending', text: 'Pending', count: pendingCount.data?.length },
    { key: 'upcoming', text: 'Upcoming' },
    { key: 'past', text: 'Past' },
  ];

  const start = rows.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = (page - 1) * PAGE_SIZE + rows.length;

  return (
    <div>
      <PageHeader
        title="Reservations"
        action={
          <Button icon={<DownloadOutlined />} onClick={() => exportCsv(rows)} disabled={rows.length === 0}>
            Export
          </Button>
        }
      />

      <Tabs
        activeKey={tab}
        onChange={(k) => update({ tab: k === 'all' ? undefined : k, status: undefined })}
        items={tabs.map((t) => ({
          key: t.key,
          label: <TabLabel text={t.text} count={t.count} active={tab === t.key} />,
        }))}
      />

      <div className={styles.toolbar}>
        <Input
          allowClear
          prefix={<SearchOutlined className="muted" />}
          placeholder="Search by guest or reference"
          value={searchInput}
          onChange={(e) => update({ search: e.target.value || undefined })}
          style={{ width: 260 }}
          aria-label="Search reservations"
        />
        {tab === 'all' && (
          <FilterChip<ReservationStatus>
            name="Status"
            value={statusParam}
            options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: label(o.value) }))}
            onChange={(v) => update({ status: v })}
          />
        )}
        <DatePicker.RangePicker
          size="small"
          className={styles.range}
          value={from && to ? [dayjs(from), dayjs(to)] : null}
          onChange={(v) => {
            const range = v as [Dayjs, Dayjs] | null;
            update({ from: range?.[0]?.format('YYYY-MM-DD'), to: range?.[1]?.format('YYYY-MM-DD') });
          }}
          placeholder={['Stay from', 'Stay to']}
          format="MMM D"
          aria-label="Stay dates"
        />
        <FilterChip<BookingSource>
          name="Source"
          value={source}
          options={BOOKING_SOURCE_OPTIONS.map((o) => ({ value: o.value, label: label(o.value) }))}
          onChange={(v) => update({ source: v })}
        />
        <FilterChip<string> name="Kubo type" value={kuboType} options={typeOptions} onChange={(v) => update({ type: v })} />
        <span className={styles.spacer} />
        <span className="muted">Sort</span>
        <Select<SortKey>
          size="small"
          value={sort}
          onChange={(v) => update({ sort: v === 'booked' ? undefined : v }, false)}
          options={[
            { value: 'booked', label: 'Newest booking' },
            { value: 'checkin', label: 'Check-in date' },
          ]}
          style={{ width: 150 }}
          aria-label="Sort reservations"
        />
      </div>

      <Section flush>
        {list.isLoading ? (
          <ListSkeleton rows={8} />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No reservations match"
            description="Try another tab or clear the filters."
            action={
              <Button size="small" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <Table<Reservation>
              rowKey="reservation_id"
              columns={columns}
              dataSource={rows}
              pagination={false}
              size="middle"
              rowSelection={{ columnWidth: 40 }}
              rowClassName={() => 'clickable-row'}
              onRow={(r) => ({
                onClick: () => navigate(`/reservations/${r.reservation_id}`),
                onKeyDown: (e) => {
                  if (e.key === 'Enter') navigate(`/reservations/${r.reservation_id}`);
                },
                tabIndex: 0,
              })}
              loading={list.isFetching && !list.isLoading}
            />
            <div className={styles.footer}>
              <span>
                Showing {start}–{end}
                {hasNext ? '' : ` of ${end}`}
              </span>
              <span className={styles.pager}>
                <Button
                  size="small"
                  icon={<LeftOutlined />}
                  aria-label="Previous page"
                  disabled={page <= 1}
                  onClick={() => update({ page: String(page - 1) }, false)}
                />
                <Button
                  size="small"
                  icon={<RightOutlined />}
                  aria-label="Next page"
                  disabled={!hasNext}
                  onClick={() => update({ page: String(page + 1) }, false)}
                />
              </span>
            </div>
          </>
        )}
      </Section>

      <CancelReservationModal reservation={cancelling} onClose={() => setCancelling(null)} />
    </div>
  );
};
