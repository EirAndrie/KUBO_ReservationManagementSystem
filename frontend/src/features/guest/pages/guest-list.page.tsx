import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App, Button, Input } from 'antd';
import { ResponsiveTable } from '@/components/common';
import type { InputRef } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, EyeOutlined, LeftOutlined, PlusOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '@/features/auth';
import {
  Avatar,
  EmptyState,
  ErrorState,
  FilterChip,
  ListSkeleton,
  PageHeader,
  RowMenu,
  Section,
  StatusBadge,
  TwoLine,
} from '@/components/common';
import type { RowMenuItem } from '@/components/common';
import { useDebouncedValue } from '@/hooks/use-debounced-value.hook';
import { formatDate, label } from '@/lib/format';
import { useGuestStayStats, useGuests } from '../hooks/use-guests.hook';
import { useCreateGuest, useDeleteGuest, useUpdateGuest } from '../hooks/use-guest-mutations.hook';
import { GuestForm } from '../components/guest-form.component';
import { VALID_ID_TYPES } from '../types/guest.types';
import type { CreateGuestDTO, Guest, UpdateGuestDTO, ValidIdType } from '../types/guest.types';
import styles from './guest-list.module.css';

const PAGE_SIZE = 10;

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

  const guests = useGuests({ search: search || undefined, validIdType: idType, limit: PAGE_SIZE, page });
  // Stays, last stay, upcoming and Returning come from the server across every
  // reservation of the guests on this page (not a capped sample).
  const pageGuests = useMemo(() => (guests.data ?? []).slice(0, PAGE_SIZE), [guests.data]);
  const pageIds = useMemo(() => pageGuests.map((g) => g.guest_id), [pageGuests]);
  const stayStats = useGuestStayStats(pageIds);
  const createGuest = useCreateGuest();
  const updateGuest = useUpdateGuest();
  const deleteGuest = useDeleteGuest();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Guest | null>(null);

  const stats = useMemo(() => new Map((stayStats.data ?? []).map((s) => [s.guest_id, s])), [stayStats.data]);

  // Delete is offered only once the server confirms the guest has no reservations,
  // and not while stats refetch: the cached count may predate a new booking.
  const canDelete = (g: Guest) => !stayStats.isFetching && stats.get(g.guest_id)?.reservations_count === 0;

  const rows = useMemo(() => {
    let data = pageGuests;
    if (city) data = data.filter((g) => (g.city ?? '').toLowerCase() === city.toLowerCase());
    if (upcomingOnly) data = data.filter((g) => stats.get(g.guest_id)?.upcoming);
    return data;
  }, [pageGuests, city, upcomingOnly, stats]);

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    (guests.data ?? []).forEach((g) => g.city && set.add(g.city));
    if (city) set.add(city);
    return [...set].sort().map((c) => ({ value: c, label: c }));
  }, [guests.data, city]);

  const hasNext = (guests.data?.length ?? 0) === PAGE_SIZE;
  const pastLastPage = page > 1 && (guests.data?.length ?? 0) === 0;
  const fullName = (g: Guest) => `${g.first_name} ${g.last_name}`.trim();

  const menuFor = (g: Guest): RowMenuItem[] => {
    const items: RowMenuItem[] = [
      { key: 'view', label: 'View profile', icon: <EyeOutlined />, onClick: () => navigate(`/guests/${g.guest_id}`) },
    ];
    if (isStaff) {
      items.push({ key: 'edit', label: 'Edit details', icon: <EditOutlined />, onClick: () => { setEditing(g); setFormOpen(true); } });
    }
    if (isAdmin && canDelete(g)) {
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
          <TwoLine
            primary={
              <span className={styles.nameRow}>
                {fullName(g)}
                {stats.get(g.guest_id)?.is_returning && <StatusBadge status="Returning" tone="violet" text="Returning" />}
              </span>
            }
            secondary={g.email}
          />
        </span>
      ),
    },
    { title: 'Phone', dataIndex: 'phone', width: 160, render: (v: string) => <span className="tabular">{v}</span> },
    { title: 'City', dataIndex: 'city', width: 150, render: (v?: string | null) => v || <span className="muted">—</span> },
    {
      title: 'Stays',
      width: 80,
      align: 'right',
      // "—" until the server stats for this guest arrive (never a false 0).
      render: (_, g) => <span className="tabular">{stats.get(g.guest_id)?.stays ?? '—'}</span>,
    },
    {
      title: 'Last stay',
      width: 130,
      render: (_, g) => <span className="tabular">{formatDate(stats.get(g.guest_id)?.last_stay)}</span>,
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

      {stayStats.isError && (
        <p className="muted" role="status">
          Couldn't load stay history, so Stays, Last stay, and the Returning badge are unavailable.{' '}
          <Button type="link" size="small" onClick={() => stayStats.refetch()}>
            Retry
          </Button>
        </p>
      )}
      <Section flush>
        {guests.isLoading ? (
          <ListSkeleton rows={8} />
        ) : guests.isError ? (
          <ErrorState error={guests.error} onRetry={() => guests.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={
              pastLastPage
                ? 'No more guests'
                : search || idType || city || upcomingOnly
                  ? 'No guests match'
                  : 'No guests yet'
            }
            description={
              pastLastPage
                ? 'You are past the last page.'
                : search
                  ? `Nothing found for “${search}”.`
                  : 'Registered guests appear here.'
            }
            action={
              pastLastPage ? (
                <Button size="small" onClick={() => set({ page: String(page - 1) }, false)}>
                  Previous page
                </Button>
              ) : (
                isStaff && (
                  <Button size="small" onClick={() => { setEditing(null); setFormOpen(true); }}>
                    Register a guest
                  </Button>
                )
              )
            }
          />
        ) : (
          <>
            <ResponsiveTable<Guest>
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
