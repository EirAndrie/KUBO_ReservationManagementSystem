import React, { useMemo, useState } from 'react';
import { App, Button, Progress, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useKubos } from '@/features/kubo';
import { useReservations } from '@/features/reservation';
import { EmptyState, ErrorState, ListSkeleton, PageHeader, RowMenu, Section, TwoLine } from '@/components/common';
import { formatMoneyWhole, pluralize } from '@/lib/format';
import { useKuboTypes } from '../hooks/use-kubo-types.hook';
import { useCreateKuboType, useDeleteKuboType, useUpdateKuboType } from '../hooks/use-kubo-type-mutations.hook';
import { KuboTypeDrawer } from '../components/kubo-type-drawer.component';
import type { CreateKuboTypeDTO, KuboType } from '../types/kubo-type.types';
import styles from './kubo-type-list.module.css';

/**
 * Kubo types & rates (Administrator). A plain table with kubo counts and
 * tonight's occupancy; create and edit happen in a side drawer. Types that
 * still have kubos can't be deleted, so Delete is disabled with a reason.
 */
export const KuboTypeListPage: React.FC = () => {
  const { modal } = App.useApp();
  const types = useKuboTypes();
  const kubos = useKubos();
  const pending = useReservations({ status: 'Pending', limit: 100 });
  const confirmed = useReservations({ status: 'Confirmed', limit: 100 });
  const checkedIn = useReservations({ status: 'CheckedIn', limit: 100 });
  const createType = useCreateKuboType();
  const updateType = useUpdateKuboType();
  const deleteType = useDeleteKuboType();
  const [drawer, setDrawer] = useState<{ type: KuboType | null } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const usage = useMemo(() => {
    const map = new Map<string, { total: number; occupied: number }>();
    (kubos.data ?? []).forEach((k) => {
      const u = map.get(k.kuboTypeId) ?? { total: 0, occupied: 0 };
      u.total += 1;
      if (k.status === 'Occupied') u.occupied += 1;
      map.set(k.kuboTypeId, u);
    });
    return map;
  }, [kubos.data]);

  // Active bookings per type name; they keep their booked rate when the rate changes.
  const bookingsByTypeName = useMemo(() => {
    const map = new Map<string, number>();
    [...(pending.data ?? []), ...(confirmed.data ?? []), ...(checkedIn.data ?? [])].forEach((r) => {
      const names = new Set(r.assignments.map((a) => a.type_name ?? ''));
      names.forEach((n) => map.set(n, (map.get(n) ?? 0) + 1));
    });
    return map;
  }, [pending.data, confirmed.data, checkedIn.data]);

  const submit = async (values: CreateKuboTypeDTO) => {
    setServerError(null);
    try {
      if (drawer?.type) await updateType.mutateAsync({ id: drawer.type.kubo_type_id, data: values });
      else await createType.mutateAsync(values);
      setDrawer(null);
    } catch (err) {
      setServerError((err as Error).message);
    }
  };

  const columns: ColumnsType<KuboType> = [
    { title: 'Type', render: (_, t) => <TwoLine primary={t.type_name} secondary={t.description || undefined} /> },
    { title: 'Capacity', width: 120, render: (_, t) => pluralize(t.capacity, 'guest') },
    { title: 'Nightly rate', align: 'right', width: 140, render: (_, t) => <span className="tabular">{formatMoneyWhole(t.price_per_night)}</span> },
    { title: 'Kubos', align: 'right', width: 90, render: (_, t) => <span className="tabular">{usage.get(t.kubo_type_id)?.total ?? 0}</span> },
    {
      title: 'Occupancy tonight',
      width: 200,
      render: (_, t) => {
        const u = usage.get(t.kubo_type_id);
        const pct = u?.total ? Math.round((u.occupied / u.total) * 100) : 0;
        return (
          <div className={styles.occupancy}>
            <Progress percent={pct} showInfo={false} size="small" aria-label={`${pct}% occupied`} />
            <span className="muted tabular">{u ? `${u.occupied}/${u.total}` : '—'}</span>
          </div>
        );
      },
    },
    {
      key: 'menu',
      width: 48,
      align: 'center',
      render: (_, t) => {
        const inUse = (usage.get(t.kubo_type_id)?.total ?? 0) > 0;
        return (
          <RowMenu
            label={`Actions for ${t.type_name}`}
            items={[
              { key: 'edit', label: 'Edit type & rate', icon: <EditOutlined />, onClick: () => { setServerError(null); setDrawer({ type: t }); } },
              { key: 'd', divider: true },
              {
                key: 'delete',
                label: 'Delete type',
                icon: <DeleteOutlined />,
                danger: true,
                disabled: inUse,
                reason: 'Types with kubos can’t be deleted. Move or remove those kubos first.',
                onClick: () =>
                  modal.confirm({
                    title: `Delete ${t.type_name}?`,
                    content: 'This type has no kubos. It is removed permanently.',
                    okText: 'Delete type',
                    okButtonProps: { danger: true },
                    onOk: () => deleteType.mutateAsync(t.kubo_type_id),
                  }),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Kubo types & rates"
        description="Rate changes apply to new reservations only. Existing bookings keep their rate."
        action={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setServerError(null); setDrawer({ type: null }); }}>
            New type
          </Button>
        }
      />
      <Section flush>
        {types.isLoading ? (
          <ListSkeleton rows={5} />
        ) : types.isError ? (
          <ErrorState error={types.error} onRetry={() => types.refetch()} />
        ) : (types.data ?? []).length === 0 ? (
          <EmptyState title="No kubo types yet" action={<Button size="small" onClick={() => setDrawer({ type: null })}>Create the first type</Button>} />
        ) : (
          <Table<KuboType>
            rowKey="kubo_type_id"
            columns={columns}
            dataSource={types.data}
            pagination={false}
            size="middle"
            rowClassName={() => 'clickable-row'}
            onRow={(t) => ({ onClick: () => { setServerError(null); setDrawer({ type: t }); } })}
          />
        )}
      </Section>

      <KuboTypeDrawer
        open={Boolean(drawer)}
        kuboType={drawer?.type}
        bookingsOnType={drawer?.type ? bookingsByTypeName.get(drawer.type.type_name) ?? 0 : 0}
        isLoading={createType.isPending || updateType.isPending}
        serverError={serverError}
        onClose={() => setDrawer(null)}
        onSubmit={submit}
      />
    </div>
  );
};
