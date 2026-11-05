import React, { useState, useMemo, useCallback } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Alert,
  Tag,
  Popconfirm,
  Empty,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  UserAddOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  IdcardOutlined,
  ReloadOutlined,
  FilterOutlined,
  QuestionCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useGuests } from '../hooks/use-guests.hook';
import { useCreateGuest, useUpdateGuest, useDeleteGuest } from '../hooks/use-guest-mutations.hook';
import { GuestForm } from '../components/guest-form.component';
import { ID_TYPE_LABEL_MAP, ID_TYPE_OPTIONS } from '../constants/guest.constants';
import type { Guest, CreateGuestDTO, UpdateGuestDTO, ValidIdType } from '../types/guest.types';
import styles from './guest-list.module.css';

const { Text } = Typography;

/**
 * Primary Guest Directory management page.
 *
 * Implements:
 * - BR-009/BR-012: Required guest contact fields shown in table columns.
 * - BR-013: "Register New Guest" primary action with inline search-first UX.
 * - BR-015: Destructive delete requires Popconfirm confirmation.
 * - WCAG 2.2 AA: Keyboard-navigable table, visible focus rings, non-color-only status indicators.
 * - Zero Emoji Policy: All iconography from @ant-design/icons.
 */
export const GuestListPage: React.FC = () => {
  const navigate = useNavigate();

  // Filter/search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [idTypeFilter, setIdTypeFilter] = useState<ValidIdType | 'all'>('all');
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const queryParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    validIdType: idTypeFilter !== 'all' ? idTypeFilter : undefined,
    limit: 100,
  }), [debouncedSearch, idTypeFilter]);

  const { data: rawGuests, isLoading, isError, error, refetch } = useGuests(queryParams);
  const createMutation = useCreateGuest();
  const updateMutation = useUpdateGuest();
  const deleteMutation = useDeleteGuest();

  const guests = useMemo(() => rawGuests ?? [], [rawGuests]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(value.trim());
    }, 350);
    setSearchDebounceTimer(timer);
  }, [searchDebounceTimer]);

  const handleOpenCreate = () => {
    setEditingGuest(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (guest: Guest) => {
    setEditingGuest(guest);
    setIsFormOpen(true);
  };

  const handleCloseModal = () => {
    setIsFormOpen(false);
    setEditingGuest(null);
  };

  const handleSubmitForm = async (values: CreateGuestDTO | UpdateGuestDTO) => {
    if (editingGuest) {
      await updateMutation.mutateAsync({ id: editingGuest.guest_id, data: values as UpdateGuestDTO });
    } else {
      await createMutation.mutateAsync(values as CreateGuestDTO);
    }
    handleCloseModal();
  };

  const handleDelete = async (guestId: string) => {
    try {
      setDeletingId(guestId);
      await deleteMutation.mutateAsync(guestId);
    } finally {
      setDeletingId(null);
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const columns: ColumnsType<Guest> = [
    {
      title: 'Guest',
      key: 'guest',
      width: 240,
      render: (_, record) => (
        <div className={styles.guestNameCell}>
          <span className={styles.guestNamePrimary}>
            {record.first_name} {record.last_name}
          </span>
          <span className={styles.guestEmail}>{record.email}</span>
        </div>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      width: 160,
      render: (phone: string) => (
        <span className={styles.phoneText}>{phone}</span>
      ),
    },
    {
      title: 'Valid ID Type',
      dataIndex: 'valid_id_type',
      key: 'valid_id_type',
      width: 180,
      render: (idType: ValidIdType) => (
        <span className={styles.idBadge}>
          <IdcardOutlined style={{ fontSize: '0.75rem' }} aria-hidden="true" />
          {ID_TYPE_LABEL_MAP[idType]}
        </span>
      ),
    },
    {
      title: 'ID Number',
      dataIndex: 'id_number',
      key: 'id_number',
      width: 160,
      render: (idNum: string) => (
        <Text copyable={{ text: idNum }} style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>
          {idNum}
        </Text>
      ),
    },
    {
      title: 'City',
      key: 'city',
      width: 130,
      render: (_, record) => (
        <span style={{ color: record.city ? '#374151' : '#9ca3af', fontSize: '0.85rem' }}>
          {record.city || <em>Not specified</em>}
        </span>
      ),
    },
    {
      title: 'Registered',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) =>
        date ? (
          <Tag style={{ fontSize: '0.78rem', margin: 0 }}>
            {new Date(date).toLocaleDateString('en-PH', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Tag>
        ) : (
          <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Unknown</span>
        ),
    },
    {
      title: '',
      key: 'actions',
      width: 140,
      fixed: 'right' as const,
      align: 'right' as const,
      render: (_, record) => (
        <div className={styles.actionsCell}>
          <Button
            size="small"
            icon={<EyeOutlined aria-hidden="true" />}
            onClick={() => navigate(`/guests/${record.guest_id}`)}
            aria-label={`View details for ${record.first_name} ${record.last_name}`}
          >
            View
          </Button>
          <Button
            size="small"
            icon={<EditOutlined aria-hidden="true" />}
            onClick={() => handleOpenEdit(record)}
            aria-label={`Edit ${record.first_name} ${record.last_name}`}
          />
          <Popconfirm
            title="Remove guest record"
            description={
              <div style={{ maxWidth: 240 }}>
                <div>
                  Remove <strong>{record.first_name} {record.last_name}</strong>?
                </div>
                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 4 }}>
                  Guests with existing reservations cannot be deleted (BR-015).
                </div>
              </div>
            }
            onConfirm={() => handleDelete(record.guest_id)}
            okText="Remove"
            cancelText="Keep"
            okButtonProps={{ danger: true, loading: deletingId === record.guest_id }}
            icon={<QuestionCircleOutlined style={{ color: '#ff4d4f' }} aria-hidden="true" />}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined aria-hidden="true" />}
              loading={deletingId === record.guest_id}
              aria-label={`Delete ${record.first_name} ${record.last_name}`}
            />
          </Popconfirm>
        </div>
      ),
    },
  ];

  const idTypeFilterOptions = [
    { label: 'All ID Types', value: 'all' },
    ...ID_TYPE_OPTIONS.map((opt) => ({ label: opt.label, value: opt.value })),
  ];

  return (
    <main className={styles.pageContainer} aria-label="Guest Directory">
      {/* Error Banner */}
      {isError && (
        <Alert
          className={styles.errorBanner}
          type="error"
          showIcon
          message="Failed to load guest records"
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

      {/* Hero Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)',
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#bae6fd', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            <span>Resort Guest Management</span>
          </div>
          <h1 style={{ margin: 0, color: '#ffffff', fontSize: '2.1rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            Guest Directory
          </h1>
          <p style={{ margin: '8px 0 0', color: '#e0f2fe', fontSize: '0.95rem', maxWidth: 520 }}>
            Search, register, and manage resort guest profiles with government-issued ID verification and reservation history.
          </p>
        </div>
        <Button
          type="primary"
          icon={<UserAddOutlined aria-hidden="true" />}
          size="large"
          onClick={handleOpenCreate}
          style={{
            height: 46,
            padding: '0 24px',
            fontSize: '1rem',
            fontWeight: 600,
            background: '#3b82f6',
            borderColor: '#3b82f6',
          }}
          aria-label="Register new guest"
        >
          Register Guest
        </Button>
      </div>

      {/* Toolbar: Search + Filter */}
      <section className={styles.toolbarContainer} aria-label="Search and filter controls">
        <div className={styles.searchGroup}>
          <Input
            className={styles.searchInput}
            placeholder="Search by name, email, or phone..."
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} aria-hidden="true" />}
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            allowClear
            aria-label="Search guests"
          />
          <Select
            className={styles.filterSelect}
            value={idTypeFilter}
            onChange={(val) => setIdTypeFilter(val)}
            suffixIcon={<FilterOutlined style={{ color: '#9ca3af' }} aria-hidden="true" />}
            options={idTypeFilterOptions}
            aria-label="Filter by ID type"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={styles.resultsBadge} aria-live="polite">
            {guests.length} {guests.length === 1 ? 'guest' : 'guests'} found
          </span>
          <Button
            icon={<UserAddOutlined aria-hidden="true" />}
            type="primary"
            onClick={handleOpenCreate}
          >
            Register Guest
          </Button>
        </div>
      </section>

      {/* Guest Table / Empty State */}
      {!isLoading && guests.length === 0 ? (
        <div className={styles.emptyStateCard} role="status">
          <Empty
            image={<InboxOutlined style={{ fontSize: 56, color: '#9ca3af' }} aria-hidden="true" />}
            description={
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', margin: '0 0 6px 0' }}>
                  {debouncedSearch || idTypeFilter !== 'all'
                    ? 'No Guests Match Your Search'
                    : 'No Guest Profiles Registered'}
                </p>
                <p style={{ color: '#6b7280', margin: 0, maxWidth: 400 }}>
                  {debouncedSearch || idTypeFilter !== 'all'
                    ? 'Try adjusting your search term or clearing the ID type filter.'
                    : 'Register your first guest profile to start tracking reservations and contact information.'}
                </p>
              </div>
            }
          >
            {debouncedSearch || idTypeFilter !== 'all' ? (
              <Button
                type="default"
                onClick={() => {
                  setSearchTerm('');
                  setDebouncedSearch('');
                  setIdTypeFilter('all');
                }}
              >
                Reset Filters
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<UserAddOutlined aria-hidden="true" />}
                size="large"
                style={{ marginTop: 12 }}
                onClick={handleOpenCreate}
              >
                Register First Guest
              </Button>
            )}
          </Empty>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <Table<Guest>
            dataSource={guests}
            columns={columns}
            rowKey="guest_id"
            loading={isLoading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} guests`,
              pageSizeOptions: ['10', '20', '50'],
            }}
            scroll={{ x: 900 }}
            size="middle"
            aria-label="Guest directory table"
          />
        </div>
      )}

      {/* Create / Edit Form Modal */}
      <GuestForm
        open={isFormOpen}
        initialData={editingGuest}
        isLoading={isMutating}
        onCancel={handleCloseModal}
        onSubmit={handleSubmitForm}
      />
    </main>
  );
};
