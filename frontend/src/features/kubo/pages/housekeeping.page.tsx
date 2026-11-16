import React from 'react';
import { Button } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  ResponsiveTable,
  Section,
  StatusBadge,
} from '@/components/common';
import { pluralize } from '@/lib/format';
import { useCleaningKubos } from '../hooks/use-kubos.hook';
import { useMarkKuboReady } from '../hooks/use-kubo-mutations.hook';
import type { Kubo } from '../types/kubo.types';

/**
 * Staff housekeeping queue (BR-021, BR-063). Check-out moves a kubo to
 * `Cleaning`; once it is cleaned, Staff mark it ready, which returns it to
 * `Available` and writes an audit row. Other status changes (maintenance,
 * inspection, out of service) stay with Administrators on the Kubos page.
 */
export const HousekeepingPage: React.FC = () => {
  const kubos = useCleaningKubos();
  const markReady = useMarkKuboReady();
  const rows = kubos.data ?? [];

  const columns: ColumnsType<Kubo> = [
    { title: 'Kubo', render: (_, k) => <span className="mono">{k.kuboNumber}</span> },
    { title: 'Type', dataIndex: 'typeName' },
    { title: 'Sleeps', align: 'right', width: 90, render: (_, k) => <span className="tabular">{k.capacity}</span> },
    { title: 'Status', width: 130, render: (_, k) => <StatusBadge status={k.status} /> },
    {
      key: 'actions',
      align: 'right',
      width: 150,
      render: (_, k) => (
        <Button
          size="small"
          type="primary"
          icon={<CheckOutlined />}
          loading={markReady.isPending && markReady.variables === k.kuboId}
          disabled={markReady.isPending && markReady.variables !== k.kuboId}
          onClick={() => markReady.mutate(k.kuboId)}
        >
          Mark ready
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Housekeeping"
        description="Kubos waiting to be cleaned after check-out. Mark one ready when it's clean to make it bookable again."
      />
      <Section
        flush
        title={rows.length > 0 ? `${pluralize(rows.length, 'kubo')} to clean` : 'To clean'}
      >
        {kubos.isLoading ? (
          <ListSkeleton rows={4} />
        ) : kubos.isError ? (
          <ErrorState error={kubos.error} onRetry={() => kubos.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing to clean."
            description="Kubos appear here when a guest checks out."
          />
        ) : (
          <ResponsiveTable<Kubo>
            rowKey="kuboId"
            columns={columns}
            dataSource={rows}
            pagination={false}
            size="middle"
          />
        )}
      </Section>
    </div>
  );
};
