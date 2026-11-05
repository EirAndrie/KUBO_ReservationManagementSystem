import { useState, useMemo, useCallback } from 'react';
import {
  Typography,
  Button,
  Input,
  Select,
  Empty,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/features/auth';
import { useKubos } from '../hooks/use-kubos.hook';
import { KuboCard } from '../components/kubo-card.component';
import { KuboFormModal } from '../components/kubo-form-modal.component';
import { KuboStatusModal } from '../components/kubo-status-modal.component';
import { KUBO_STATUS_OPTIONS } from '../constants/kubo.constants';
import type { Kubo, KuboFilterParams, KuboStatus } from '../types/kubo.types';
import styles from './kubo-list.module.css';

const { Title, Paragraph } = Typography;

export function KuboListPage() {
  const { role } = useAuth();
  const isAdmin = role === 'Administrator';

  const [filters, setFilters] = useState<KuboFilterParams>({});
  const { data: kubos = [], isLoading, refetch } = useKubos(filters);

  // Modals
  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const [isStatusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedKubo, setSelectedKubo] = useState<Kubo | null>(null);

  // Summary counts
  const summary = useMemo(() => {
    let available = 0;
    let occupied = 0;
    let cleaning = 0;
    let maintenance = 0;

    for (const k of kubos) {
      if (k.status === 'Available') available++;
      else if (k.status === 'Occupied') occupied++;
      else if (k.status === 'Cleaning') cleaning++;
      else if (k.status === 'Maintenance' || k.status === 'OutOfService') maintenance++;
    }

    return {
      total: kubos.length,
      available,
      occupied,
      cleaning,
      maintenance,
    };
  }, [kubos]);

  const handleOpenCreate = () => {
    setSelectedKubo(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (kubo: Kubo) => {
    setSelectedKubo(kubo);
    setFormModalOpen(true);
  };

  const handleOpenStatus = (kubo: Kubo) => {
    setSelectedKubo(kubo);
    setStatusModalOpen(true);
  };

  const handleSearchChange = useCallback((text: string) => {
    setFilters((prev) => ({ ...prev, search: text || undefined }));
  }, []);

  const handleStatusChange = useCallback((status: KuboStatus | 'All' | undefined) => {
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const hasActiveFilters = Boolean(filters.search || (filters.status && filters.status !== 'All'));

  return (
    <main className={styles.pageContainer} aria-label="Kubo Cottages Inventory">
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <Title level={2} className={styles.pageTitle}>
            Kubo Cottages & Housekeeping
          </Title>
          <Paragraph className={styles.pageDescription}>
            Monitor physical unit availability, housekeeping cleanliness, and maintenance status (BR-017, BR-021).
          </Paragraph>
        </div>
        <div className={styles.headerActions}>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Refresh
          </Button>
          {isAdmin && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
              style={{ background: '#0284c7', borderColor: '#0284c7' }}
            >
              Register Cottage Unit
            </Button>
          )}
        </div>
      </div>

      {/* Summary KPI Counters */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Inventory</div>
          <div className={styles.statValue}>{summary.total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Available For Check-In</div>
          <div className={styles.statValue} style={{ color: '#16a34a' }}>
            {summary.available}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Occupied / In-House</div>
          <div className={styles.statValue} style={{ color: '#7c3aed' }}>
            {summary.occupied}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Cleaning / Housekeeping</div>
          <div className={styles.statValue} style={{ color: '#d97706' }}>
            {summary.cleaning}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterItem} style={{ flex: 1, minWidth: 220 }}>
          <label className={styles.filterLabel}>Search Cottage Number</label>
          <Input.Search
            placeholder="Search by cottage identifier or category"
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            allowClear
          />
        </div>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Filter by Unit Status</label>
          <Select
            allowClear
            placeholder="All Statuses"
            options={[{ value: 'All', label: 'All Statuses' }, ...KUBO_STATUS_OPTIONS]}
            value={filters.status}
            onChange={handleStatusChange}
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

      {/* Cards Grid Content */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : kubos.length === 0 ? (
        <div className={styles.emptyState}>
          <Empty
            description={
              hasActiveFilters
                ? 'No cottages match your active filter criteria.'
                : 'No kubo cottages found in the inventory.'
            }
          />
          {isAdmin && !hasActiveFilters && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
              style={{ marginTop: 16, background: '#0284c7', borderColor: '#0284c7' }}
            >
              Register First Cottage Unit
            </Button>
          )}
        </div>
      ) : (
        <div className={styles.cardsGrid}>
          {kubos.map((kubo) => (
            <KuboCard
              key={kubo.kuboId}
              kubo={kubo}
              onEdit={handleOpenEdit}
              onStatusChange={handleOpenStatus}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <KuboFormModal
        open={isFormModalOpen}
        onClose={() => setFormModalOpen(false)}
        kubo={selectedKubo}
      />

      <KuboStatusModal
        open={isStatusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        kubo={selectedKubo}
      />
    </main>
  );
}
