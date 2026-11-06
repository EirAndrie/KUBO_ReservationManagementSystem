import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Segmented, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined, EnvironmentOutlined, EyeInvisibleOutlined, EyeOutlined, MailOutlined, PhoneOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/features/auth';
import { ReservationWizard, billedNights, stayOf } from '@/features/reservation';
import {
  Avatar,
  ErrorState,
  KpiStrip,
  ListSkeleton,
  PageHeader,
  Section,
  StatusBadge,
} from '@/components/common';
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context';
import { formatDate, formatMoney, formatMoneyWhole, formatStayRange, label, maskId, toAmount } from '@/lib/format';
import { useGuest, useGuestReservations } from '../hooks/use-guests.hook';
import { useUpdateGuest } from '../hooks/use-guest-mutations.hook';
import { GuestForm } from '../components/guest-form.component';
import type { GuestReservationHistoryItem, UpdateGuestDTO } from '../types/guest.types';
import styles from './guest-detail.module.css';

type HistoryFilter = 'all' | 'upcoming' | 'past';

const NOT_COUNTED = ['Cancelled', 'NoShow'];

/**
 * Guest profile: compact header with contact chips, lifetime KPIs derived from
 * this guest's reservations (Cancelled and No-show excluded), reservation
 * history with real dates and reference codes, and side cards for a masked ID
 * (explicit reveal, re-masked on leaving) and the address.
 */
export const GuestDetailPage: React.FC = () => {
  const { guestId = '' } = useParams<{ guestId: string }>();
  const navigate = useNavigate();
  const { isStaff } = useAuth();
  const guest = useGuest(guestId);
  const history = useGuestReservations(guestId);
  const updateGuest = useUpdateGuest();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [revealed, setRevealed] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const g = guest.data;
  const name = g ? `${g.first_name} ${g.last_name}`.trim() : '';
  useBreadcrumbLabel(name || null);

  const reservations = useMemo(() => history.data ?? [], [history.data]);
  const counted = reservations.filter((r) => !NOT_COUNTED.includes(r.status));
  const nights = counted.reduce((sum, r) => sum + billedNights(r.assignments), 0);
  const spend = counted.reduce((sum, r) => sum + toAmount(r.charges_total), 0);

  const today = dayjs().startOf('day');
  const rows = reservations
    .filter((r) => {
      const stay = stayOf(r.assignments);
      if (filter === 'upcoming') return stay.checkIn && !dayjs(stay.checkIn).isBefore(today) && ['Pending', 'Confirmed'].includes(r.status);
      if (filter === 'past') return ['CheckedOut', 'Cancelled', 'NoShow'].includes(r.status) || (stay.checkOut && dayjs(stay.checkOut).isBefore(today));
      return true;
    })
    .sort((a, b) => (stayOf(b.assignments).checkIn ?? '').localeCompare(stayOf(a.assignments).checkIn ?? ''));

  if (guest.isLoading) return <ListSkeleton rows={10} />;
  if (guest.isError || !g) {
    return (
      <Section>
        <ErrorState error={guest.error ?? new Error('Guest not found.')} onRetry={() => guest.refetch()} />
      </Section>
    );
  }

  const columns: ColumnsType<GuestReservationHistoryItem> = [
    { title: 'Reference', dataIndex: 'reference_code', render: (v: string) => <span className="mono">{v}</span> },
    {
      title: 'Kubo',
      render: (_, r) => {
        const [first, ...rest] = r.assignments;
        return first ? `${first.kubo_number} · ${first.type_name ?? ''}${rest.length ? ` +${rest.length}` : ''}` : '—';
      },
    },
    {
      title: 'Stay',
      render: (_, r) => {
        const s = stayOf(r.assignments);
        return <span className="tabular">{formatStayRange(s.checkIn, s.checkOut)}</span>;
      },
    },
    { title: 'Status', dataIndex: 'status', render: (v: string) => <StatusBadge status={v} /> },
    {
      title: 'Total',
      align: 'right',
      render: (_, r) =>
        NOT_COUNTED.includes(r.status) ? <span className="muted">—</span> : <span className="tabular">{formatMoney(r.charges_total)}</span>,
    },
  ];

  const place = [g.city, g.country].filter(Boolean).join(', ');

  return (
    <div>
      <PageHeader
        leading={<Avatar name={name} size={44} />}
        title={name}
        description={
          <span className={styles.chips}>
            <span>
              <MailOutlined /> {g.email}
            </span>
            <span>
              <PhoneOutlined /> {g.phone}
            </span>
            {place && (
              <span>
                <EnvironmentOutlined /> {place}
              </span>
            )}
          </span>
        }
        action={
          isStaff && (
            <>
              <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setWizardOpen(true)}>
                New reservation
              </Button>
            </>
          )
        }
      />

      <KpiStrip
        loading={history.isLoading}
        items={[
          { label: 'Stays', value: counted.length },
          { label: 'Nights', value: nights },
          { label: 'Total spend', value: formatMoneyWhole(spend) },
          { label: 'Guest since', value: formatDate(g.created_at, 'MMM YYYY') },
        ]}
      />

      <div className={styles.grid}>
        <Section
          title="Reservations"
          flush
          extra={
            <Segmented<HistoryFilter>
              size="small"
              value={filter}
              onChange={setFilter}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Upcoming', value: 'upcoming' },
                { label: 'Past', value: 'past' },
              ]}
            />
          }
        >
          {history.isLoading ? (
            <ListSkeleton rows={4} />
          ) : history.isError ? (
            <ErrorState error={history.error} onRetry={() => history.refetch()} />
          ) : (
            <Table<GuestReservationHistoryItem>
              rowKey="reservation_id"
              columns={columns}
              dataSource={rows}
              pagination={false}
              size="middle"
              locale={{ emptyText: filter === 'all' ? 'No reservations yet.' : `No ${filter} reservations.` }}
              rowClassName={() => 'clickable-row'}
              onRow={(r) => ({ onClick: () => navigate(`/reservations/${r.reservation_id}`) })}
            />
          )}
        </Section>

        <div className={styles.side}>
          <Section title="Identification">
            <dl className={styles.dl}>
              <dt>ID type</dt>
              <dd>{label(g.valid_id_type)}</dd>
              <dt>ID number</dt>
              <dd className={styles.idRow}>
                <span className="mono">{revealed ? g.id_number : maskId(g.id_number)}</span>
                <Tooltip title={revealed ? 'Hide ID number' : 'Show ID number'}>
                  <Button
                    type="text"
                    size="small"
                    icon={revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    aria-label={revealed ? 'Hide ID number' : 'Show ID number'}
                    aria-pressed={revealed}
                    onClick={() => setRevealed((v) => !v)}
                  />
                </Tooltip>
              </dd>
            </dl>
          </Section>
          <Section title="Address">
            <dl className={styles.dl}>
              <dt>Street</dt>
              <dd>{g.address_line_1 || '—'}</dd>
              <dt>City</dt>
              <dd>{g.city || '—'}</dd>
              <dt>Province</dt>
              <dd>{g.state_province || '—'}</dd>
              <dt>ZIP code</dt>
              <dd>{g.zip_postal_code || '—'}</dd>
              <dt>Country</dt>
              <dd>{g.country || '—'}</dd>
            </dl>
          </Section>
        </div>
      </div>

      <GuestForm
        open={editOpen}
        initialData={g}
        isLoading={updateGuest.isPending}
        onCancel={() => setEditOpen(false)}
        onSubmit={async (values) => {
          await updateGuest.mutateAsync({ id: g.guest_id, data: values as UpdateGuestDTO });
          setEditOpen(false);
        }}
      />
      {wizardOpen && (
        <ReservationWizard
          open
          initialGuest={g}
          onCancel={() => setWizardOpen(false)}
          onSuccess={() => {
            setWizardOpen(false);
            history.refetch();
          }}
        />
      )}
    </div>
  );
};
