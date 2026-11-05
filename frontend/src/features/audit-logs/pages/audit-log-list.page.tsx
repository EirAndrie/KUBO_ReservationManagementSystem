import { useState, useMemo, useCallback } from 'react';
import {
  Typography,
  Button,
  Table,
  Tag,
  Select,
  Input,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AuditOutlined,
  ClearOutlined,
  EyeOutlined,
  FieldTimeOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuditLogs } from '../hooks/use-audit-logs.hook';
import { AuditDetailModal } from '../components/audit-detail-modal.component';
import {
  AUDIT_ACTION_TAGS,
  AUDIT_ACTION_OPTIONS,
  AUDIT_ACTION_LABELS,
} from '../constants/audit-log.constants';
import type { AuditLog, AuditLogFilterParams, AuditAction } from '../types/audit-log.types';
import styles from './audit-log-list.module.css';

const { Title, Paragraph } = Typography;

const ENTITY_OPTIONS = [
  { value: 'reservation', label: 'Reservation' },
  { value: 'kubo', label: 'Kubo Cottage' },
  { value: 'kubo_type', label: 'Kubo Type / Rate' },
  { value: 'payment', label: 'Payment / Refund' },
  { value: 'additional_charge', label: 'Additional Charge' },
  { value: 'employee', label: 'Employee / Staff' },
  { value: 'role', label: 'Role' },
  { value: 'reserved_kubo', label: 'Check-In / Out Assignment' },
];

export function AuditLogListPage() {
  const [filters, setFilters] = useState<AuditLogFilterParams>({});
  const { data: logs = [], isLoading } = useAuditLogs(filters);

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);

  const summary = useMemo(() => {
    let authEvents = 0;
    let configEvents = 0;
    let operationalEvents = 0;

    for (const l of logs) {
      if (l.action === 'login' || l.action === 'logout') authEvents++;
      else if (l.entityType === 'kubo_type' || l.entityType === 'role' || l.entityType === 'kubo') configEvents++;
      else operationalEvents++;
    }

    return {
      total: logs.length,
      authEvents,
      configEvents,
      operationalEvents,
    };
  }, [logs]);

  const handleOpenDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailModalOpen(true);
  };

  const handleSearchChange = useCallback((text: string) => {
    setFilters((prev) => ({ ...prev, search: text || undefined }));
  }, []);

  const handleActionChange = useCallback((action: AuditAction | undefined) => {
    setFilters((prev) => ({ ...prev, action }));
  }, []);

  const handleEntityChange = useCallback((entityType: string | undefined) => {
    setFilters((prev) => ({ ...prev, entityType }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const hasActiveFilters = Boolean(filters.search || filters.action || filters.entityType);

  const columns: ColumnsType<AuditLog> = useMemo(
    () => [
      {
        title: 'Timestamp',
        dataIndex: 'dateTime',
        key: 'dateTime',
        width: 170,
        sorter: (a, b) => dayjs(a.dateTime).unix() - dayjs(b.dateTime).unix(),
        defaultSortOrder: 'descend',
        render: (date: string) => (
          <span style={{ fontSize: '0.82rem', color: '#475569' }}>
            <FieldTimeOutlined style={{ marginRight: 6, color: '#94a3b8' }} />
            {dayjs(date).format('MMM D, YYYY h:mm A')}
          </span>
        ),
      },
      {
        title: 'Action',
        dataIndex: 'action',
        key: 'action',
        width: 120,
        render: (action: AuditAction) => {
          const tagConfig = AUDIT_ACTION_TAGS[action] || { color: 'default' };
          return (
            <Tag color={tagConfig.color}>
              {AUDIT_ACTION_LABELS[action] || action}
            </Tag>
          );
        },
      },
      {
        title: 'Entity',
        key: 'entity',
        width: 150,
        render: (_, record) => (
          <div>
            <Tag color="blue" style={{ margin: 0 }}>
              {record.entityType || 'Entity'}
            </Tag>
          </div>
        ),
      },
      {
        title: 'Activity Description',
        dataIndex: 'description',
        key: 'description',
        render: (desc: string) => (
          <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 500 }}>
            {desc}
          </span>
        ),
      },
      {
        title: 'Performed By',
        key: 'actor',
        width: 180,
        render: (_, record) => (
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
            <UserOutlined style={{ marginRight: 6, color: '#94a3b8' }} />
            {record.employeeName || record.employeeId.slice(0, 8)}
          </span>
        ),
      },
      {
        title: 'Detail',
        key: 'detail',
        width: 90,
        align: 'right',
        render: (_, record) => (
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetail(record)}
          >
            Diff
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <main className={styles.pageContainer} aria-label="System Audit Activity Trail">
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <Title level={2} className={styles.pageTitle}>
            <AuditOutlined style={{ marginRight: 8 }} />
            System Audit Activity Log
          </Title>
          <Paragraph className={styles.pageDescription}>
            Immutable chronological audit record for bookings, rate updates, check-ins, payments, and security (BR-067, BR-078).
          </Paragraph>
        </div>
      </div>

      {/* Summary KPI Counters */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Audited Events</div>
          <div className={styles.statValue}>{summary.total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Security & Auth Events</div>
          <div className={styles.statValue} style={{ color: '#0284c7' }}>
            {summary.authEvents}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Rate & Inventory Changes</div>
          <div className={styles.statValue} style={{ color: '#0284c7' }}>
            {summary.configEvents}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Operational Actions</div>
          <div className={styles.statValue} style={{ color: '#16a34a' }}>
            {summary.operationalEvents}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterItem} style={{ flex: 1, minWidth: 220 }}>
          <label className={styles.filterLabel}>Search Event Records</label>
          <Input.Search
            placeholder="Search by description or personnel name"
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            allowClear
          />
        </div>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Filter by Action</label>
          <Select
            allowClear
            placeholder="All Actions"
            options={AUDIT_ACTION_OPTIONS}
            value={filters.action as AuditAction | undefined}
            onChange={handleActionChange}
            style={{ width: '100%' }}
          />
        </div>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Filter by Entity</label>
          <Select
            allowClear
            placeholder="All Entities"
            options={ENTITY_OPTIONS}
            value={filters.entityType}
            onChange={handleEntityChange}
            style={{ width: '100%' }}
          />
        </div>
        {hasActiveFilters && (
          <div className={styles.filterClear}>
            <Button icon={<ClearOutlined />} onClick={clearFilters} size="small">
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className={styles.tableContainer}>
        <Table<AuditLog>
          dataSource={logs}
          columns={columns}
          rowKey="auditLogId"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          size="middle"
        />
      </div>

      {/* Detail Diff Modal */}
      <AuditDetailModal
        open={isDetailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        log={selectedLog}
      />
    </main>
  );
}
