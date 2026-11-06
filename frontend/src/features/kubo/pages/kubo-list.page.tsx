import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App, Button, Input, Segmented, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AppstoreOutlined,
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  SwapOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/features/auth';
import { useReservations } from '@/features/reservation';
import type { Reservation } from '@/features/reservation';
import { EmptyState, ErrorState, ListSkeleton, PageHeader, RowMenu, Section, StatusBadge } from '@/components/common';
import type { RowMenuItem } from '@/components/common';
import { formatDate, formatMoneyWhole, label, pluralize } from '@/lib/format';
import { useKubos } from '../hooks/use-kubos.hook';
import { useChangeKuboStatus, useDeleteKubo } from '../hooks/use-kubo-mutations.hook';
import { KuboFormModal } from '../components/kubo-form-modal.component';
import { KuboStatusModal } from '../components/kubo-status-modal.component';
import { KUBO_STATUSES } from '../types/kubo.types';
import type { Kubo, KuboStatus } from '../types/kubo.types';
import styles from './kubo-list.module.css';

type View = 'board' | 'list';

interface KuboContext {
  text: string;
  reservationId?: string;
}

/** What is happening with a kubo, from existing reservation data only (no new fields). */
function contextFor(kubo: Kubo, current: Map<string, Reservation>, next: Map<string, { r: Reservation; date: string }>): KuboContext {
  const today = dayjs().format('YYYY-MM-DD');
  const occupying = current.get(kubo.kuboId);
  const upcoming = next.get(kubo.kuboId);
  const shortName = (name: string) => {
    const [first, ...rest] = name.split(' ');
    return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
  };
  switch (kubo.status) {
    case 'Occupied': {
      if (!occupying) return { text: 'In use' };
      const out = occupying.assignments.find((a) => a.kubo_id === kubo.kuboId)?.check_out_date;
      return {
        text: `${occupying.guest_name} · out ${out === today ? 'today' : formatDate(out, 'MMM D')}`,
        reservationId: occupying.reservation_id,
      };
    }
    case 'Reserved':
    case 'Available':
      if (upcoming) {
        return {
          text: upcoming.date === today ? `${shortName(upcoming.r.guest_name)} · arrival today` : `${shortName(upcoming.r.guest_name)} · in ${formatDate(upcoming.date, 'MMM D')}`,
          reservationId: upcoming.r.reservation_id,
        };
      }
      return { text: kubo.status === 'Reserved' ? 'Held for a booking' : 'Ready for arrival' };
    case 'Cleaning':
      return { text: 'Turnover after check-out' };
    case 'UnderInspection':
      return { text: 'Being inspected' };
    default:
      return { text: 'Not bookable' };
  }
}

/**
 * Kubos: Board (grouped by kubo type, capacity and rate shown once per group)
 * or List. Status chips with counts filter the view. Tile context comes from
 * Confirmed/CheckedIn reservations. Status changes, including "Mark clean",
 * are Administrator actions in the backend, so Staff see them disabled.
 */
export const KuboListPage: React.FC = () => {
  const navigate = useNavigate();
  const { modal } = App.useApp();
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View) || 'board';
  const status = (params.get('status') as KuboStatus) || undefined;
  const search = params.get('search') ?? '';

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const kubos = useKubos();
  const checkedIn = useReservations({ status: 'CheckedIn', limit: 100 });
  const confirmed = useReservations({ status: 'Confirmed', limit: 100 });
  const changeStatus = useChangeKuboStatus();
  const deleteKubo = useDeleteKubo();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Kubo | null>(null);
  const [statusFor, setStatusFor] = useState<Kubo | null>(null);

  const { current, next } = useMemo(() => {
    const cur = new Map<string, Reservation>();
    const nxt = new Map<string, { r: Reservation; date: string }>();
    const today = dayjs().format('YYYY-MM-DD');
    (checkedIn.data ?? []).forEach((r) =>
      r.assignments.forEach((a) => {
        if (a.status === 'CheckedIn') cur.set(a.kubo_id, r);
        else if (a.status === 'Reserved' && a.check_in_date >= today) {
          const prev = nxt.get(a.kubo_id);
          if (!prev || a.check_in_date < prev.date) nxt.set(a.kubo_id, { r, date: a.check_in_date });
        }
      }),
    );
    (confirmed.data ?? []).forEach((r) =>
      r.assignments.forEach((a) => {
        if (a.status !== 'Reserved' || a.check_out_date <= today) return;
        const prev = nxt.get(a.kubo_id);
        if (!prev || a.check_in_date < prev.date) nxt.set(a.kubo_id, { r, date: a.check_in_date });
      }),
    );
    return { current: cur, next: nxt };
  }, [checkedIn.data, confirmed.data]);

  const all = useMemo(
    () => [...(kubos.data ?? [])].sort((a, b) => a.kuboNumber.localeCompare(b.kuboNumber, undefined, { numeric: true })),
    [kubos.data],
  );
  const q = search.trim().toLowerCase();
  const filtered = all.filter(
    (k) => (!status || k.status === status) && (!q || k.kuboNumber.toLowerCase().includes(q) || k.typeName.toLowerCase().includes(q)),
  );
  const counts = useMemo(() => {
    const m = new Map<KuboStatus, number>();
    all.forEach((k) => m.set(k.status, (m.get(k.status) ?? 0) + 1));
    return m;
  }, [all]);
  const typeCount = new Set(all.map((k) => k.kuboTypeId)).size;

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; capacity: number; rate: number; items: Kubo[] }>();
    filtered.forEach((k) => {
      const g = map.get(k.kuboTypeId) ?? { name: k.typeName, capacity: k.capacity, rate: k.pricePerNight, items: [] };
      g.items.push(k);
      map.set(k.kuboTypeId, g);
    });
    return [...map.values()].sort((a, b) => a.rate - b.rate);
  }, [filtered]);

  const markClean = (k: Kubo) => changeStatus.mutate({ kuboId: k.kuboId, status: 'Available' });

  const menuFor = (k: Kubo): RowMenuItem[] =>
    isAdmin
      ? [
          { key: 'edit', label: 'Edit details', icon: <EditOutlined />, onClick: () => { setEditing(k); setFormOpen(true); } },
          { key: 'status', label: 'Change status', icon: <SwapOutlined />, onClick: () => setStatusFor(k) },
          { key: 'd', divider: true },
          {
            key: 'delete',
            label: 'Delete kubo',
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () =>
              modal.confirm({
                title: `Delete ${k.kuboNumber}?`,
                content: 'Only kubos that were never booked can be deleted. Otherwise, mark it out of service.',
                okText: 'Delete kubo',
                okButtonProps: { danger: true },
                onOk: () => deleteKubo.mutateAsync(k.kuboId),
              }),
          },
        ]
      : [];

  const markCleanButton = (k: Kubo) => (
    <Tooltip title={isAdmin ? undefined : 'Only an administrator can change a kubo’s status.'}>
      <Button
        size="small"
        icon={<CheckOutlined />}
        disabled={!isAdmin}
        loading={changeStatus.isPending && changeStatus.variables?.kuboId === k.kuboId}
        onClick={(e) => {
          e.stopPropagation();
          markClean(k);
        }}
      >
        Mark clean
      </Button>
    </Tooltip>
  );

  const columns: ColumnsType<Kubo> = [
    { title: 'Kubo', dataIndex: 'kuboNumber', width: 100, render: (v: string) => <strong>{v}</strong> },
    { title: 'Type', dataIndex: 'typeName' },
    { title: 'Capacity', dataIndex: 'capacity', width: 110, render: (v: number) => pluralize(v, 'guest') },
    { title: 'Nightly rate', align: 'right', width: 130, render: (_, k) => <span className="tabular">{formatMoneyWhole(k.pricePerNight)}</span> },
    { title: 'Status', width: 150, render: (_, k) => <StatusBadge status={k.status} /> },
    { title: 'Now', render: (_, k) => <span className="muted">{contextFor(k, current, next).text}</span> },
    {
      key: 'actions',
      width: 150,
      align: 'right',
      render: (_, k) => (
        <span className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
          {k.status === 'Cleaning' && markCleanButton(k)}
          <RowMenu items={menuFor(k)} label={`Actions for ${k.kuboNumber}`} />
        </span>
      ),
    },
  ];

  const chips: Array<{ key?: KuboStatus; label: string; count: number }> = [
    { label: 'All', count: all.length },
    ...KUBO_STATUSES.filter((s) => (counts.get(s) ?? 0) > 0 || ['Available', 'Occupied', 'Reserved', 'Cleaning', 'Maintenance', 'OutOfService'].includes(s)).map((s) => ({
      key: s,
      label: label(s),
      count: counts.get(s) ?? 0,
    })),
  ];

  return (
    <div>
      <PageHeader
        title="Kubos"
        description={kubos.isSuccess ? `${pluralize(all.length, 'kubo')} · ${pluralize(typeCount, 'type')}` : undefined}
        action={
          <>
            <Segmented<View>
              value={view}
              onChange={(v) => set({ view: v === 'board' ? undefined : v })}
              options={[
                { value: 'board', label: 'Board', icon: <AppstoreOutlined /> },
                { value: 'list', label: 'List', icon: <UnorderedListOutlined /> },
              ]}
            />
            {isAdmin && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setFormOpen(true); }}>
                Add kubo
              </Button>
            )}
          </>
        }
      />

      <div className={styles.toolbar}>
        <div className={styles.chips} role="group" aria-label="Filter by status">
          {chips.map((c) => {
            const active = status === c.key;
            return (
              <button
                key={c.label}
                type="button"
                aria-pressed={active}
                className={`${styles.statusChip} ${active ? styles.statusChipActive : ''}`}
                onClick={() => set({ status: c.key })}
              >
                {c.key ? <StatusBadge status={c.key} text={c.label} /> : <span className={styles.allLabel}>All</span>}
                <span className={styles.chipCount}>{c.count}</span>
              </button>
            );
          })}
        </div>
        <Input
          allowClear
          prefix={<SearchOutlined className="muted" />}
          placeholder="Find a kubo"
          value={search}
          onChange={(e) => set({ search: e.target.value || undefined })}
          style={{ width: 220 }}
          aria-label="Find a kubo"
        />
      </div>

      {kubos.isLoading ? (
        <Section flush>
          <ListSkeleton rows={8} />
        </Section>
      ) : kubos.isError ? (
        <Section flush>
          <ErrorState error={kubos.error} onRetry={() => kubos.refetch()} />
        </Section>
      ) : filtered.length === 0 ? (
        <Section flush>
          <EmptyState
            title="No kubos match"
            description="Clear the status filter or search."
            action={<Button size="small" onClick={() => set({ status: undefined, search: undefined })}>Show all kubos</Button>}
          />
        </Section>
      ) : view === 'list' ? (
        <Section flush>
          <Table<Kubo>
            rowKey="kuboId"
            columns={columns}
            dataSource={filtered}
            pagination={false}
            size="middle"
            rowClassName={(k) => (contextFor(k, current, next).reservationId ? 'clickable-row' : '')}
            onRow={(k) => ({
              onClick: () => {
                const id = contextFor(k, current, next).reservationId;
                if (id) navigate(`/reservations/${id}`);
              },
            })}
          />
        </Section>
      ) : (
        <div className={styles.board}>
          {groups.map((g) => (
            <section key={g.name} aria-label={g.name}>
              <h2 className={styles.groupTitle}>
                {g.name}
                <span className="muted">
                  {pluralize(g.capacity, 'guest')} · {formatMoneyWhole(g.rate)}/night
                </span>
              </h2>
              <div className={styles.tiles}>
                {g.items.map((k) => {
                  const ctx = contextFor(k, current, next);
                  const menu = menuFor(k);
                  return (
                    <div
                      key={k.kuboId}
                      className={`${styles.tile} ${ctx.reservationId ? styles.tileClickable : ''}`}
                      onClick={() => ctx.reservationId && navigate(`/reservations/${ctx.reservationId}`)}
                      onKeyDown={(e) => e.key === 'Enter' && ctx.reservationId && navigate(`/reservations/${ctx.reservationId}`)}
                      tabIndex={ctx.reservationId ? 0 : undefined}
                      role={ctx.reservationId ? 'link' : undefined}
                    >
                      <div className={styles.tileHead}>
                        <strong className={styles.tileNumber}>{k.kuboNumber}</strong>
                        <span className={styles.tileRight}>
                          <StatusBadge status={k.status} />
                          {menu.length > 0 && <RowMenu items={menu} label={`Actions for ${k.kuboNumber}`} />}
                        </span>
                      </div>
                      <div className={styles.tileContext}>{ctx.text}</div>
                      {k.status === 'Cleaning' && <div className={styles.tileAction}>{markCleanButton(k)}</div>}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <KuboFormModal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} kubo={editing} />
      <KuboStatusModal open={Boolean(statusFor)} onClose={() => setStatusFor(null)} kubo={statusFor} />
    </div>
  );
};
