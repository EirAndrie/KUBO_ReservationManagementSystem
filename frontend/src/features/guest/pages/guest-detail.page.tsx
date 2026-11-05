import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Skeleton, Alert, Tag, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  EditOutlined,
  MailOutlined,
  PhoneOutlined,
  IdcardOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useGuest, useGuestReservations } from '../hooks/use-guests.hook';
import { useUpdateGuest } from '../hooks/use-guest-mutations.hook';
import { GuestForm } from '../components/guest-form.component';
import { ID_TYPE_LABEL_MAP } from '../constants/guest.constants';
import type { UpdateGuestDTO, GuestReservationHistoryItem } from '../types/guest.types';
import styles from './guest-detail.module.css';

const { Title, Text } = Typography;

type ReservationStatus =
  | 'Pending'
  | 'Confirmed'
  | 'CheckedIn'
  | 'CheckedOut'
  | 'Cancelled'
  | 'NoShow';

const STATUS_COLOR: Record<ReservationStatus, string> = {
  Pending: '#eab308',
  Confirmed: '#2563eb',
  CheckedIn: '#16a34a',
  CheckedOut: '#7c3aed',
  Cancelled: '#ef4444',
  NoShow: '#6b7280',
};

const STATUS_LABEL: Record<ReservationStatus, string> = {
  Pending: 'Pending',
  Confirmed: 'Confirmed',
  CheckedIn: 'Checked In',
  CheckedOut: 'Checked Out',
  Cancelled: 'Cancelled',
  NoShow: 'No Show',
};

/**
 * Full-detail view for a single guest profile.
 *
 * Displays:
 * - Contact information (name, email, phone).
 * - Government identification (ID type + number).
 * - Optional address details.
 * - Paginated reservation history table with status, check-in/out dates, and kubo type.
 *
 * Implements WCAG 2.2 AA: focus-visible header buttons, non-color-only status badges,
 * keyboard navigable table rows. Zero Emoji Policy strictly applied.
 */
export const GuestDetailPage: React.FC = () => {
  const { guestId } = useParams<{ guestId: string }>();
  const navigate = useNavigate();

  const {
    data: guest,
    isLoading: isGuestLoading,
    isError: isGuestError,
    error: guestError,
    refetch: refetchGuest,
  } = useGuest(guestId);

  const {
    data: reservations,
    isLoading: isReservationsLoading,
    isError: isReservationsError,
    refetch: refetchReservations,
  } = useGuestReservations(guestId);

  const updateMutation = useUpdateGuest();

  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleEditSubmit = async (values: UpdateGuestDTO) => {
    if (!guestId) return;
    await updateMutation.mutateAsync({ id: guestId, data: values });
    setIsFormOpen(false);
  };

  const reservationColumns: ColumnsType<GuestReservationHistoryItem> = [
    {
      title: 'Reservation ID',
      dataIndex: 'reservation_id',
      key: 'reservation_id',
      width: 120,
      render: (id: string) => (
        <Text copyable={{ text: id }} style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
          {id.slice(0, 8)}...
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: ReservationStatus) => (
        <Tag
          className={styles.statusTag}
          style={{
            background: `${STATUS_COLOR[status]}15`,
            borderColor: `${STATUS_COLOR[status]}40`,
            color: STATUS_COLOR[status],
          }}
          aria-label={`Reservation status: ${STATUS_LABEL[status]}`}
        >
          {STATUS_LABEL[status]}
        </Tag>
      ),
    },
    {
      title: 'Check-In Date',
      dataIndex: 'check_in_date',
      key: 'check_in_date',
      width: 130,
      render: (date: string) => (
        <span style={{ fontSize: '0.85rem' }}>
          {new Date(date).toLocaleDateString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      title: 'Check-Out Date',
      dataIndex: 'check_out_date',
      key: 'check_out_date',
      width: 130,
      render: (date: string) => (
        <span style={{ fontSize: '0.85rem' }}>
          {new Date(date).toLocaleDateString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      title: 'Booking Source',
      dataIndex: 'booking_source',
      key: 'booking_source',
      width: 130,
      render: (src: string) => (
        <span style={{ fontSize: '0.83rem', color: '#374151' }}>{src}</span>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 110,
      render: (date: string) => (
        <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
          {new Date(date).toLocaleDateString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      ),
    },
  ];

  if (isGuestLoading) {
    return (
      <main className={styles.pageContainer}>
        <Skeleton active paragraph={{ rows: 12 }} />
      </main>
    );
  }

  if (isGuestError || !guest) {
    return (
      <main className={styles.pageContainer}>
        <Alert
          className={styles.errorBanner}
          type="error"
          showIcon
          message="Failed to load guest profile"
          description={
            guestError instanceof Error
              ? guestError.message
              : 'The requested guest could not be found or the server is unavailable.'
          }
          action={
            <Button
              size="small"
              danger
              icon={<ReloadOutlined aria-hidden="true" />}
              onClick={() => refetchGuest()}
            >
              Retry
            </Button>
          }
        />
        <Button
          icon={<ArrowLeftOutlined aria-hidden="true" />}
          onClick={() => navigate('/guests')}
          style={{ marginTop: 12 }}
        >
          Back to Guest Directory
        </Button>
      </main>
    );
  }

  const initials = `${guest.first_name.charAt(0)}${guest.last_name.charAt(0)}`.toUpperCase();

  const hasAddress = guest.address_line_1 || guest.city || guest.state_province;

  return (
    <main className={styles.pageContainer} aria-label={`Guest profile: ${guest.first_name} ${guest.last_name}`}>
      {/* Back navigation */}
      <button
        className={styles.backLink}
        onClick={() => navigate('/guests')}
        aria-label="Back to guest directory"
      >
        <ArrowLeftOutlined aria-hidden="true" />
        <span>Guest Directory</span>
      </button>

      {/* Hero Header Card */}
      <section className={styles.headerCard} aria-label="Guest profile header">
        <div className={styles.headerMain}>
          <div className={styles.headerAvatar} aria-hidden="true">
            {initials}
          </div>
          <div className={styles.headerNameGroup}>
            <Title level={1} className={styles.guestName}>
              {guest.first_name} {guest.last_name}
            </Title>
            <div className={styles.headerMeta}>
              <span className={styles.metaItem}>
                <MailOutlined aria-hidden="true" />
                <span>{guest.email}</span>
              </span>
              <span className={styles.metaItem} aria-label="Phone number">
                <PhoneOutlined aria-hidden="true" />
                <span style={{ fontFamily: 'monospace' }}>{guest.phone}</span>
              </span>
              {guest.city && (
                <span className={styles.metaItem}>
                  <EnvironmentOutlined aria-hidden="true" />
                  <span>{guest.city}{guest.state_province ? `, ${guest.state_province}` : ''}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button
            type="default"
            icon={<EditOutlined aria-hidden="true" />}
            onClick={() => setIsFormOpen(true)}
            style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}
            aria-label={`Edit ${guest.first_name} ${guest.last_name}'s profile`}
          >
            Edit Profile
          </Button>
        </div>
      </section>

      {/* Two-column detail layout */}
      <div className={styles.contentGrid}>
        {/* Left column: Contact + ID + Address */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Contact Details */}
          <Card className={styles.infoCard} bodyStyle={{ padding: 20 }}>
            <h2 className={styles.sectionTitle}>
              <MailOutlined aria-hidden="true" />
              Contact Details
            </h2>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Full Name</span>
              <span className={styles.infoValue}>
                {guest.first_name} {guest.last_name}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Email Address</span>
              <a href={`mailto:${guest.email}`} className={styles.infoValue} style={{ color: '#0369a1' }}>
                {guest.email}
              </a>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Phone Number</span>
              <a href={`tel:${guest.phone}`} className={styles.infoValue} style={{ fontFamily: 'monospace', color: '#0369a1' }}>
                {guest.phone}
              </a>
            </div>
          </Card>

          {/* Government ID */}
          <Card className={styles.infoCard} bodyStyle={{ padding: 20 }}>
            <h2 className={styles.sectionTitle}>
              <IdcardOutlined aria-hidden="true" />
              Government Identification
            </h2>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>ID Type</span>
              <span className={styles.infoValue}>
                {ID_TYPE_LABEL_MAP[guest.valid_id_type]}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>ID Number</span>
              <Text copyable={{ text: guest.id_number }} className={styles.infoValue} style={{ fontFamily: 'monospace' }}>
                {guest.id_number}
              </Text>
            </div>
          </Card>

          {/* Address */}
          <Card className={styles.infoCard} bodyStyle={{ padding: 20 }}>
            <h2 className={styles.sectionTitle}>
              <EnvironmentOutlined aria-hidden="true" />
              Residential Address
            </h2>
            {hasAddress ? (
              <>
                {guest.address_line_1 && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Street Address</span>
                    <span className={styles.infoValue}>{guest.address_line_1}</span>
                  </div>
                )}
                {guest.city && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>City / Municipality</span>
                    <span className={styles.infoValue}>{guest.city}</span>
                  </div>
                )}
                {guest.state_province && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Province / Region</span>
                    <span className={styles.infoValue}>{guest.state_province}</span>
                  </div>
                )}
                {guest.zip_postal_code && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Postal Code</span>
                    <span className={styles.infoValue}>{guest.zip_postal_code}</span>
                  </div>
                )}
                {guest.country && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Country</span>
                    <span className={styles.infoValue}>{guest.country}</span>
                  </div>
                )}
              </>
            ) : (
              <p className={styles.emptyAddress}>No address details on file for this guest.</p>
            )}
          </Card>

          {/* Record Timestamps */}
          {(guest.created_at || guest.updated_at) && (
            <Card className={styles.infoCard} bodyStyle={{ padding: 20 }}>
              <h2 className={styles.sectionTitle}>
                <CalendarOutlined aria-hidden="true" />
                Record History
              </h2>
              {guest.created_at && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Registered</span>
                  <span className={styles.infoValue}>
                    {new Date(guest.created_at).toLocaleDateString('en-PH', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
              {guest.updated_at && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Last Updated</span>
                  <span className={styles.infoValue}>
                    {new Date(guest.updated_at).toLocaleDateString('en-PH', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right column: Reservation History */}
        <Card
          className={styles.historyCard}
          bodyStyle={{ padding: 0 }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TeamOutlined style={{ color: '#0369a1' }} aria-hidden="true" />
              <span>Reservation History</span>
              {!isReservationsLoading && reservations && (
                <Tag style={{ marginLeft: 4, fontWeight: 600 }}>
                  {reservations.length} {reservations.length === 1 ? 'reservation' : 'reservations'}
                </Tag>
              )}
            </div>
          }
          extra={
            isReservationsError && (
              <Button
                size="small"
                icon={<ReloadOutlined aria-hidden="true" />}
                onClick={() => refetchReservations()}
              >
                Retry
              </Button>
            )
          }
        >
          {isReservationsError ? (
            <Alert
              style={{ margin: 16, borderRadius: 8 }}
              type="warning"
              showIcon
              message="Could not load reservation history"
              description="Failed to retrieve reservations for this guest."
            />
          ) : (
            <Table<GuestReservationHistoryItem>
              dataSource={reservations ?? []}
              columns={reservationColumns}
              rowKey="reservation_id"
              loading={isReservationsLoading}
              pagination={{
                pageSize: 10,
                showTotal: (total) => `${total} ${total === 1 ? 'reservation' : 'reservations'}`,
              }}
              locale={{
                emptyText: (
                  <div style={{ padding: '32px 0', color: '#9ca3af', fontSize: '0.875rem' }}>
                    <CalendarOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} aria-hidden="true" />
                    No reservations on record for this guest.
                  </div>
                ),
              }}
              size="small"
              aria-label={`Reservation history for ${guest.first_name} ${guest.last_name}`}
            />
          )}
        </Card>
      </div>

      {/* Edit Profile Modal */}
      <GuestForm
        open={isFormOpen}
        initialData={guest}
        isLoading={updateMutation.isPending}
        onCancel={() => setIsFormOpen(false)}
        onSubmit={handleEditSubmit}
      />
    </main>
  );
};
