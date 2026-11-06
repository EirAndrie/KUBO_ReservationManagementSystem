import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App, Button, Input, Table } from 'antd';
import type { InputRef } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, EyeOutlined, LeftOutlined, PlusOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/features/auth';
import { stayOf, useReservations } from '@/features/reservation';
import {
  Avatar,
  EmptyState,
  ErrorState,
  FilterChip,
  ListSkeleton,
  PageHeader,
  RowMenu,
  Section,
  TwoLine,
} from '@/components/common';
import type { RowMenuItem } from '@/components/common';
import { useDebouncedValue } from '@/hooks/use-debounced-value.hook';
import { formatDate, label } from '@/lib/format';
import { useGuests } from '../hooks/use-guests.hook';
import { useCreateGuest, useDeleteGuest, useUpdateGuest } from '../hooks/use-guest-mutations.hook';
import { GuestForm } from '../components/guest-form.component';
import { VALID_ID_TYPES } from '../types/guest.types';
import type { CreateGuestDTO, Guest, UpdateGuestDTO, ValidIdType } from '../types/guest.types';
import styles from './guest-list.module.css';

const PAGE_SIZE = 25;

interface StayStats {
  stays: number;
  lastStay: string | null;
  upcoming: boolean;
}

/**
 * Guests: a large server-side search (debounced ~300ms, `/` focuses it),
 * add-on filter chips, and one "Register guest" action. ID numbers are not
 * shown in the list. Delete sits in `⋯`, only for Administrators and only
 * for guests with no reservations.
 */
export const GuestListPage: React.FC = () => {
  const navigate = useNavigate();
  const { modal } = App.useApp();
  const { isAdmin, isStaff } = useAuth();
  const [params, setParams] = useSearchParams();
  const searchRef = useRef<InputRef>(null);

  const searchInput = params.get('search') ?? '';
  const search = useDebouncedValue(searchInput.trim(), 300);
  const idType = (params.get('idType') as ValidIdType) || undefined;
  const city = params.get('city') || undefined;
  const upcomingOnly = params.get('upcoming') === '1';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const set = (patch: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== '/' || el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const guests = useGuests({ search: search || undefined, validIdType: idType, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE });
  // Stays and last stay come from the latest reservations (one request, no new endpoint).
  const reservations = useReservations({ limit: 100 });
  const createGuest = useCreateGuest();
  const updateGuest = useUpdateGuest();
  const deleteGuest = useDeleteGuest();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Guest | null>(null);

  const stats = useMemo(() => {
    const map = new Map<string, StayStats>();
    const today = dayjs().startOf('day');
    (reservations.data ?? []).forEach((r) => {
      const s = map.get(r.guest_id) ?? { stays: 0, lastStay: null, upcoming: false };
      if (!['Cancelled', 'NoShow'].includes(r.status)) {
        s.stays += 1;
        const start = stayOf(r.assignments).checkIn;
        if (start && (!s.lastStay || start > s.lastStay)) s.lastStay = start;
        if (start && dayjs(start).isAfter(today) && ['Pending', 'Confirmed'].includes(r.status)) s.upcoming = true;
      }
      map.set(r.guest_id, s);
    });
    return map;
  }, [reservations.data]);

  const hasReservations = (g: Guest) => (reservations.data ?? []).some((r) => r.guest_id === g.guest_id);

  const rows = useMemo(() => {
    let data = (guests.data ?? []).slice(0, PAGE_SIZE);
    if (city) data = data.filter((g) => (g.city ?? '').toLowerCase() === city.toLowerCase());
    if (upcomingOnly) data = data.filter((g) => stats.get(g.guest_id)?.upcoming);
    return data;
  }, [guests.data, city, upcomingOnly, stats]);

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    (guests.data ?? []).forEach((g) => g.city && set.add(g.city));
    if (city) set.add(city);
    return [...set].sort().map((c) => ({ value: c, label: c }));
  }, [guests.data, city]);

  const hasNext = (guests.data?.length ?? 0) > PAGE_SIZE;
  const fullName = (g: Guest) => `${g.first_name} ${g.last_name}`.trim();

  const menuFor = (g: Guest): RowMenuItem[] => {
    const items: RowMenuItem[] = [
      { key: 'view', label: 'View profile', icon: <EyeOutlined />, onClick: () => navigate(`/guests/${g.guest_id}`) },
    ];
    if (isStaff) {
      items.push({ key: 'edit', label: 'Edit details', icon: <EditOutlined />, onClick: () => { setEditing(g); setFormOpen(true); } });
    }
    if (isAdmin && !hasReservations(g)) {
      items.push({ key: 'd', divider: true });
      items.push({
        key: 'delete',
        label: 'Delete guest',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: () =>
          modal.confirm({
            title: `Delete ${fullName(g)}?`,
            content: 'This guest has no reservations. Their profile is removed permanently. This can’t be undone.',
            okText: 'Delete guest',
            okButtonProps: { danger: true },
            onOk: () => deleteGuest.mutateAsync(g.guest_id),
          }),
      });
    }
    return items;
  };

  const columns: ColumnsType<Guest> = [
    {
      title: 'Guest',
      render: (_, g) => (
        <span className={styles.person}>
          <Avatar name={fullName(g)} />
          <TwoLine primary={fullName(g)} secondary={g.email} />
        </span>
      ),
    },
    { title: 'Phone', dataIndex: 'phone', width: 160, render: (v: string) => <span className="tabular">{v}</span> },
    { title: 'City', dataIndex: 'city', width: 150, render: (v?: string | null) => v || <span className="muted">—</span> },
    {
      title: 'Stays',
      width: 80,
      align: 'right',
      render: (_, g) => <span className="tabular">{stats.get(g.guest_id)?.stays ?? 0}</span>,
    },
    {
      title: 'Last stay',
      width: 130,
      render: (_, g) => <span className="tabular">{formatDate(stats.get(g.guest_id)?.lastStay)}</span>,
    },
    { key: 'menu', width: 48, align: 'center', render: (_, g) => <RowMenu items={menuFor(g)} label={`Actions for ${fullName(g)}`} /> },
  ];

  const submitForm = async (values: CreateGuestDTO | UpdateGuestDTO) => {
    if (editing) {
      await updateGuest.mutateAsync({ id: editing.guest_id, data: values as UpdateGuestDTO });
    } else {
      await createGuest.mutateAsync(values as CreateGuestDTO);
    }
    setFormOpen(false);
    setEditing(null);
  };

  const start = rows.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = (page - 1) * PAGE_SIZE + rows.length;

  return (
    <div>
      <PageHeader
        title="Guests"
        description={guests.isSuccess ? `${rows.length}${hasNext ? '+' : ''} guest profile${rows.length === 1 ? '' : 's'}` : undefined}
        action={
          isStaff && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setFormOpen(true); }}>
              Register guest
            </Button>
          )
        }
      />

      <div className={styles.toolbar}>
        <Input
          ref={searchRef}
          size="large"
          allowClear
          className={styles.search}
          prefix={<SearchOutlined className="muted" />}
          suffix={<kbd className={styles.kbd}>/</kbd>}
          placeholder="Search name, email or phone"
          value={searchInput}
          onChange={(e) => set({ search: e.target.value || undefined })}
          aria-label="Search guests"
        />
        <FilterChip<ValidIdType>
          name="ID type"
          value={idType}
          options={VALID_ID_TYPES.map((t) => ({ value: t, label: label(t) }))}
          onChange={(v) => set({ idType: v })}
        />
        <FilterChip<string> name="City" value={city} options={cityOptions} onChange={(v) => set({ city: v })} />
        <FilterChip<'1'>
          name="Has upcoming stay"
          value={upcomingOnly ? '1' : undefined}
          options={[{ value: '1', label: 'Yes' }]}
          onChange={(v) => set({ upcoming: v })}
        />
      </div>

      <Section flush>
        {guests.isLoading ? (
          <ListSkeleton rows={8} />
        ) : guests.isError ? (
          <ErrorState error={guests.error} onRetry={() => guests.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={search || idType || city || upcomingOnly ? 'No guests match' : 'No guests yet'}
            description={search ? `Nothing found for “${search}”.` : 'Registered guests appear here.'}
            action={
              isStaff && (
                <Button size="small" onClick={() => { setEditing(null); setFormOpen(true); }}>
                  Register a guest
                </Button>
              )
            }
          />
        ) : (
          <>
            <Table<Guest>
              rowKey="guest_id"
              columns={columns}
              dataSource={rows}
              pagination={false}
              size="middle"
              loading={guests.isFetching && !guests.isLoading}
              rowClassName={() => 'clickable-row'}
              onRow={(g) => ({ onClick: () => navigate(`/guests/${g.guest_id}`) })}
            />
            <div className={styles.footer}>
              <span>
                Showing {start}–{end}
                {hasNext ? '' : ` of ${end}`}
              </span>
              <span className={styles.pager}>
                <Button size="small" icon={<LeftOutlined />} aria-label="Previous page" disabled={page <= 1} onClick={() => set({ page: String(page - 1) }, false)} />
                <Button size="small" icon={<RightOutlined />} aria-label="Next page" disabled={!hasNext} onClick={() => set({ page: String(page + 1) }, false)} />
              </span>
            </div>
          </>
        )}
      </Section>

      <GuestForm
        open={formOpen}
        initialData={editing}
        isLoading={createGuest.isPending || updateGuest.isPending}
        onCancel={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={submitForm}
      />
    </div>
  );
};
