import React, { useState, useMemo } from 'react';
import {
  Input,
  Select,
  Button,
  Empty,
  Alert,
  Card,
  Skeleton,
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  PlusOutlined,
  ReloadOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { KuboTypeCard } from '../components/kubo-type-card.component';
import { KuboTypeForm } from '../components/kubo-type-form.component';
import { KuboTypeHeroSummary } from '../components/kubo-type-hero-summary.component';
import { useKuboTypes } from '../hooks/use-kubo-types.hook';
import {
  useCreateKuboType,
  useUpdateKuboType,
  useDeleteKuboType,
} from '../hooks/use-kubo-type-mutations.hook';
import type { KuboType, CreateKuboTypeDTO } from '../types/kubo-type.types';
import styles from './kubo-type-list.module.css';

type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'capacity-desc';

/**
 * Primary management page for resort Kubo Types & Nightly Rates.
 *
 * Responsibilities:
 * - Displays resort inventory tier classifications with responsive card grid.
 * - Enforces the "One Thing Leads" visual hierarchy with high-contrast summary hero banner.
 * - Provides real-time filtering, search, and sorting over categories.
 * - Handles full CRUD workflows for creating, modifying, and deleting kubo types.
 * - Honors BR-016 (rate & capacity boundaries), BR-020 (booking rate snapshots), and BR-022.
 * - Zero Emoji compliance using exclusively @ant-design/icons.
 */
export const KuboTypeListPage: React.FC = () => {
  const { data: rawKuboTypes, isLoading, isError, error, refetch } = useKuboTypes();

  const createMutation = useCreateKuboType();
  const updateMutation = useUpdateKuboType();
  const deleteMutation = useDeleteKuboType();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [minCapacityFilter, setMinCapacityFilter] = useState<number | 'all'>('all');

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingKuboType, setEditingKuboType] = useState<KuboType | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const kuboTypes = useMemo(() => rawKuboTypes ?? [], [rawKuboTypes]);

  // Client-side filtering and sorting for instant responsiveness
  const filteredAndSortedList = useMemo(() => {
    return kuboTypes
      .filter((item) => {
        const matchesSearch =
          item.type_name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
          (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase().trim()));

        const matchesCapacity =
          minCapacityFilter === 'all' || item.capacity >= minCapacityFilter;

        return matchesSearch && matchesCapacity;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name-asc':
            return a.type_name.localeCompare(b.type_name);
          case 'name-desc':
            return b.type_name.localeCompare(a.type_name);
          case 'price-asc':
            return Number(a.price_per_night) - Number(b.price_per_night);
          case 'price-desc':
            return Number(b.price_per_night) - Number(a.price_per_night);
          case 'capacity-desc':
            return b.capacity - a.capacity;
          default:
            return 0;
        }
      });
  }, [kuboTypes, searchTerm, sortBy, minCapacityFilter]);

  const handleOpenCreateModal = () => {
    setEditingKuboType(null);
    setIsFormOpen(true);
  };

  const handleOpenEditModal = (kuboType: KuboType) => {
    setEditingKuboType(kuboType);
    setIsFormOpen(true);
  };

  const handleCloseModal = () => {
    setIsFormOpen(false);
    setEditingKuboType(null);
  };

  const handleSubmitForm = async (values: CreateKuboTypeDTO) => {
    if (editingKuboType) {
      await updateMutation.mutateAsync({
        id: editingKuboType.kubo_type_id,
        data: values,
      });
    } else {
      await createMutation.mutateAsync(values);
    }
    handleCloseModal();
  };

  const handleDeleteKuboType = async (kuboTypeId: string) => {
    try {
      setDeletingId(kuboTypeId);
      await deleteMutation.mutateAsync(kuboTypeId);
    } finally {
      setDeletingId(null);
    }
  };

  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <main className={styles.pageContainer} aria-label="Kubo Types Management">
      {/* 1. Visual Focal Point: Hero Summary Banner ("One Thing Leads") */}
      <KuboTypeHeroSummary
        kuboTypes={kuboTypes}
        onCreateClick={handleOpenCreateModal}
      />

      {/* Error Banner when query encounters an issue */}
      {isError && (
        <Alert
          className={styles.errorBanner}
          type="error"
          showIcon
          message="Failed to load kubo categories"
          description={
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred while communicating with the server.'
          }
          action={
            <Button
              size="small"
              danger
              icon={<ReloadOutlined aria-hidden="true" />}
              onClick={() => refetch()}
            >
              Retry
            </Button>
          }
        />
      )}

      {/* 2. Interactive Filtering & Sorting Toolbar */}
      <section className={styles.toolbarContainer} aria-label="Filter and search controls">
        <div className={styles.searchGroup}>
          <Input
            className={styles.searchInput}
            placeholder="Search categories by name or amenities..."
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} aria-hidden="true" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            allowClear
            aria-label="Search kubo categories"
          />
        </div>

        <div className={styles.filterControls}>
          <Select
            style={{ width: 180 }}
            value={minCapacityFilter}
            onChange={(val) => setMinCapacityFilter(val)}
            suffixIcon={<FilterOutlined style={{ color: '#9ca3af' }} aria-hidden="true" />}
            aria-label="Filter by guest capacity"
            options={[
              { label: 'All Capacities', value: 'all' },
              { label: 'Capacity: 2+ Guests', value: 2 },
              { label: 'Capacity: 4+ Guests', value: 4 },
              { label: 'Capacity: 6+ Guests', value: 6 },
              { label: 'Capacity: 8+ Guests', value: 8 },
            ]}
          />

          <Select
            style={{ width: 210 }}
            value={sortBy}
            onChange={(val) => setSortBy(val)}
            suffixIcon={<SortAscendingOutlined style={{ color: '#9ca3af' }} aria-hidden="true" />}
            aria-label="Sort kubo categories"
            options={[
              { label: 'Name (A to Z)', value: 'name-asc' },
              { label: 'Name (Z to A)', value: 'name-desc' },
              { label: 'Rate (Lowest First)', value: 'price-asc' },
              { label: 'Rate (Highest First)', value: 'price-desc' },
              { label: 'Capacity (Largest First)', value: 'capacity-desc' },
            ]}
          />

          <span className={styles.resultsBadge} aria-live="polite">
            {filteredAndSortedList.length}{' '}
            {filteredAndSortedList.length === 1 ? 'category' : 'categories'} found
          </span>
        </div>
      </section>

      {/* 3. Main Data Content Area with 8 Interactive & Loading States */}
      {isLoading ? (
        <div className={styles.cardsGrid} aria-busy="true" aria-label="Loading kubo categories">
          {[1, 2, 3, 4, 5, 6].map((key) => (
            <Card key={key} style={{ borderRadius: 12 }}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Card>
          ))}
        </div>
      ) : kuboTypes.length === 0 ? (
        /* Empty State owning viewport when zero categories exist */
        <div className={styles.emptyStateCard} role="status">
          <Empty
            image={<InboxOutlined style={{ fontSize: 56, color: '#9ca3af' }} aria-hidden="true" />}
            description={
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', margin: '0 0 6px 0' }}>
                  No Kubo Categories Configured
                </p>
                <p style={{ color: '#6b7280', margin: 0, maxWidth: 420 }}>
                  Begin resort inventory configuration by creating your first kubo category with capacity limits and standard nightly pricing.
                </p>
              </div>
            }
          >
            <Button
              type="primary"
              icon={<PlusOutlined aria-hidden="true" />}
              size="large"
              style={{ marginTop: 16 }}
              onClick={handleOpenCreateModal}
            >
              Create First Kubo Type
            </Button>
          </Empty>
        </div>
      ) : filteredAndSortedList.length === 0 ? (
        /* Empty search/filter result state */
        <div className={styles.emptyStateCard} role="status">
          <Empty
            description={
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', margin: '0 0 6px 0' }}>
                  No Matching Categories
                </p>
                <p style={{ color: '#6b7280', margin: 0 }}>
                  No kubo categories match your current search query or capacity filter.
                </p>
              </div>
            }
          >
            <Button
              type="default"
              onClick={() => {
                setSearchTerm('');
                setMinCapacityFilter('all');
              }}
            >
              Reset Filters
            </Button>
          </Empty>
        </div>
      ) : (
        /* Rendered Cards Grid */
        <div className={styles.cardsGrid} role="list" aria-label="Kubo category cards">
          {filteredAndSortedList.map((item) => (
            <div key={item.kubo_type_id} role="listitem">
              <KuboTypeCard
                kuboType={item}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteKuboType}
                isDeleting={deletingId === item.kubo_type_id}
              />
            </div>
          ))}
        </div>
      )}

      {/* 4. Create / Edit Form Modal */}
      <KuboTypeForm
        open={isFormOpen}
        initialData={editingKuboType}
        isLoading={isMutating}
        onCancel={handleCloseModal}
        onSubmit={handleSubmitForm}
      />
    </main>
  );
};
