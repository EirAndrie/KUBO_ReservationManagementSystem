import React, { useState, useMemo } from 'react';
import {
  Modal,
  Steps,
  Button,
  DatePicker,
  Select,
  Alert,
  Spin,
  Tag,
  Empty,
} from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import {
  UserOutlined,
  CalendarOutlined,
  HomeOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  UserAddOutlined,
  InfoCircleOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/features/auth';
import { GuestSearchSelect, GuestForm } from '@/features/guest';
import type { Guest, CreateGuestDTO } from '@/features/guest';
import { useAvailableKubos } from '../hooks/use-reservations.hook';
import { useCreateReservation } from '../hooks/use-reservation-mutations.hook';
import { BOOKING_SOURCE_OPTIONS, RESERVATION_POLICIES } from '../constants/reservation.constants';
import type {
  BookingSource,
  AvailableKubo,
  CreateReservationDTO,
} from '../types/reservation.types';
import styles from './reservation-wizard.module.css';

const { RangePicker } = DatePicker;

export interface ReservationWizardProps {
  open: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
}

/**
 * Multi-step booking wizard using Ant Design Steps.
 *
 * Implements:
 * - Step 1: Select or register Guest (using GuestSearchSelect, BR-013).
 * - Step 2: Select stay dates (checkInDate, checkOutDate) and booking source.
 * - Step 3: Select available Kubos based on /api/kubos/available query.
 * - Step 4: Summary review with real-time rate calculation (nights * price_at_booking).
 * - Atomic overlap validation enforced at database level (BR-031, BR-032).
 */
export const ReservationWizard: React.FC<ReservationWizardProps> = ({
  open,
  onCancel,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: Guest Selection
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isRegisterGuestOpen, setIsRegisterGuestOpen] = useState(false);

  // Step 2: Stay Dates & Source
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>([
    dayjs().add(1, 'day'),
    dayjs().add(3, 'day'),
  ]);
  const [bookingSource, setBookingSource] = useState<BookingSource>('WalkIn');
  const { user } = useAuth();

  // Step 3: Kubo Selection
  const [selectedKubos, setSelectedKubos] = useState<AvailableKubo[]>([]);

  // Formatted date strings for queries
  const checkInStr = dateRange ? dateRange[0].format('YYYY-MM-DD') : '';
  const checkOutStr = dateRange ? dateRange[1].format('YYYY-MM-DD') : '';
  const nightsCount = useMemo(() => {
    if (!dateRange) return 0;
    return Math.max(1, dateRange[1].diff(dateRange[0], 'day'));
  }, [dateRange]);

  // Query available kubos
  const {
    data: rawAvailableKubos,
    isLoading: isLoadingKubos,
    isError: isAvailabilityError,
    error: availabilityError,
    refetch: refetchKubos,
  } = useAvailableKubos({
    checkIn: checkInStr,
    checkOut: checkOutStr,
  });

  const availableKubos = useMemo(() => rawAvailableKubos ?? [], [rawAvailableKubos]);

  const createMutation = useCreateReservation();

  // Reset wizard on open/close
  const handleClose = () => {
    setCurrentStep(0);
    setSelectedGuest(null);
    setSelectedKubos([]);
    onCancel();
  };

  const toggleKuboSelection = (kubo: AvailableKubo) => {
    setSelectedKubos((prev) => {
      const exists = prev.some((k) => k.kubo_id === kubo.kubo_id);
      if (exists) {
        return prev.filter((k) => k.kubo_id !== kubo.kubo_id);
      }
      return [...prev, kubo];
    });
  };

  // Real-time calculated accommodation subtotal
  const accommodationTotal = useMemo(() => {
    return selectedKubos.reduce((sum, kubo) => {
      return sum + Number(kubo.price_per_night) * nightsCount;
    }, 0);
  }, [selectedKubos, nightsCount]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(val);

  // Validation before proceeding
  const canProceedStep0 = Boolean(selectedGuest);
  const canProceedStep1 = Boolean(dateRange && dateRange[0] && dateRange[1] && user?.employeeId);
  const canProceedStep2 = selectedKubos.length > 0;

  const handleNext = () => {
    if (currentStep === 1) {
      refetchKubos();
    }
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  // Submit complete reservation
  const handleFinishBooking = async () => {
    if (!selectedGuest || !dateRange || selectedKubos.length === 0 || !user?.employeeId) {
      return;
    }

    const payload: CreateReservationDTO = {
      guestId: selectedGuest.guest_id,
      employeeId: user.employeeId,
      bookingSource,
      assignments: selectedKubos.map((kubo) => ({
        kuboId: kubo.kubo_id,
        checkInDate: checkInStr,
        checkOutDate: checkOutStr,
      })),
    };

    await createMutation.mutateAsync(payload);
    handleClose();
    onSuccess?.();
  };

  // Steps definition
  const stepItems = [
    { title: 'Guest', icon: <UserOutlined aria-hidden="true" /> },
    { title: 'Dates & Source', icon: <CalendarOutlined aria-hidden="true" /> },
    { title: 'Select Kubos', icon: <HomeOutlined aria-hidden="true" /> },
    { title: 'Review & Book', icon: <CheckCircleOutlined aria-hidden="true" /> },
  ];

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      width={860}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.2rem', fontWeight: 700, color: '#0c4a6e' }}>
          <HomeOutlined style={{ color: '#0284c7' }} aria-hidden="true" />
          <span>New Reservation Booking</span>
        </div>
      }
      destroyOnClose
      className={styles.wizardModal}
      maskClosable={false}
    >
      <Steps
        current={currentStep}
        items={stepItems}
        style={{ marginTop: 16, marginBottom: 8 }}
      />

      <div className={styles.stepContainer}>
        {/* Step 0: Guest Selection */}
        {currentStep === 0 && (
          <div>
            <div className={styles.sectionTitle}>
              <UserOutlined style={{ color: '#0284c7' }} aria-hidden="true" />
              <span>Step 1: Select or Register Guest</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: 16 }}>
              Search for an existing guest by full name, email, or Philippine phone number. An existing guest profile must be reused to maintain reservation history.
            </p>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <GuestSearchSelect
                  value={selectedGuest?.guest_id}
                  onChange={(_, guest) => setSelectedGuest(guest)}
                  onRegisterNew={() => setIsRegisterGuestOpen(true)}
                  placeholder="Type guest name, email or phone to search..."
                />
              </div>
              <Button
                icon={<UserAddOutlined aria-hidden="true" />}
                onClick={() => setIsRegisterGuestOpen(true)}
              >
                Register New
              </Button>
            </div>

            {selectedGuest && (
              <div className={styles.guestCard}>
                <div className={styles.guestDetails}>
                  <div className={styles.guestName}>
                    {selectedGuest.first_name} {selectedGuest.last_name}
                  </div>
                  <div className={styles.guestMeta}>
                    <span>{selectedGuest.email}</span>
                    <span>•</span>
                    <span style={{ fontFamily: 'monospace' }}>{selectedGuest.phone}</span>
                    <Tag color="blue" style={{ margin: 0 }}>
                      {selectedGuest.valid_id_type}: {selectedGuest.id_number}
                    </Tag>
                  </div>
                </div>
                <Tag color="success" icon={<CheckOutlined aria-hidden="true" />}>
                  Selected
                </Tag>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Dates & Booking Source */}
        {currentStep === 1 && (
          <div>
            <div className={styles.sectionTitle}>
              <CalendarOutlined style={{ color: '#0284c7' }} aria-hidden="true" />
              <span>Step 2: Stay Dates & Booking Details</span>
            </div>

            <div className={styles.formGridTwoCols}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Check-in to Check-out Dates <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <RangePicker
                  style={{ width: '100%', height: 40 }}
                  value={dateRange}
                  onChange={(dates) => {
                    setDateRange(dates as [Dayjs, Dayjs] | null);
                    setSelectedKubos([]);
                  }}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                  allowClear={false}
                />
                <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#0284c7', fontWeight: 600 }}>
                  Duration: {nightsCount} {nightsCount === 1 ? 'night' : 'nights'}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Booking Source <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <Select
                  style={{ width: '100%', height: 40 }}
                  value={bookingSource}
                  onChange={(val) => setBookingSource(val)}
                  options={BOOKING_SOURCE_OPTIONS}
                />
              </div>

              <div className={styles.fullWidth} style={{ marginTop: 8 }}>
                <p style={{ margin: 0, color: '#475569' }}>
                  Booking recorded under <strong>{user?.fullName ?? 'the signed-in account'}</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Kubo Selection */}
        {currentStep === 2 && (
          <div>
            <div className={styles.sectionTitle}>
              <HomeOutlined style={{ color: '#0284c7' }} aria-hidden="true" />
              <span>Step 3: Available Kubos for {checkInStr} to {checkOutStr}</span>
            </div>

            {isLoadingKubos ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <Spin size="large" />
                <p style={{ marginTop: 12, color: '#64748b' }}>Checking real-time kubo availability...</p>
              </div>
            ) : isAvailabilityError ? (
              <Alert
                type="error"
                showIcon
                message="Could not check unit availability"
                description={availabilityError instanceof Error ? availabilityError.message : 'Please try again.'}
                action={<Button size="small" onClick={() => void refetchKubos()}>Retry</Button>}
              />
            ) : availableKubos.length === 0 ? (
              <Empty
                description={
                  <div>
                    <p style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                      No Kubos Available for Selected Dates
                    </p>
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      All units are reserved, occupied, or out of service for this period. Try adjusting your stay dates.
                    </p>
                  </div>
                }
              />
            ) : (
              <div>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 12 }}>
                  Click to select one or multiple kubos to assign to this booking ({selectedKubos.length} selected):
                </p>
                <div className={styles.kuboCardGrid}>
                  {availableKubos.map((kubo) => {
                    const isSelected = selectedKubos.some((k) => k.kubo_id === kubo.kubo_id);
                    return (
                      <div
                        key={kubo.kubo_id}
                        className={`${styles.kuboCard} ${isSelected ? styles.kuboCardSelected : ''}`}
                        onClick={() => toggleKuboSelection(kubo)}
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && toggleKuboSelection(kubo)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className={styles.kuboNumber}>Kubo {kubo.kubo_number}</span>
                          {isSelected && (
                            <Tag color="blue" icon={<CheckOutlined aria-hidden="true" />} style={{ margin: 0 }}>
                              Selected
                            </Tag>
                          )}
                        </div>
                        <span className={styles.kuboType}>{kubo.type_name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#64748b' }}>
                          <TeamOutlined aria-hidden="true" />
                          <span>Up to {kubo.capacity} guests</span>
                        </div>
                        <div className={styles.kuboRate}>
                          {formatCurrency(Number(kubo.price_per_night))}
                          <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b' }}> / night</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review & Confirmation */}
        {currentStep === 3 && (
          <div>
            <div className={styles.sectionTitle}>
              <CheckCircleOutlined style={{ color: '#0284c7' }} aria-hidden="true" />
              <span>Step 4: Reservation Summary & Rate Review</span>
            </div>

            <Alert
              style={{ marginBottom: 16 }}
              message="Availability is checked again when you save"
              description={RESERVATION_POLICIES.OVERLAP_NOTICE}
              type="info"
              showIcon
              icon={<InfoCircleOutlined aria-hidden="true" />}
            />

            <div className={styles.summaryBox}>
              <div className={styles.summaryRow}>
                <span style={{ color: '#64748b' }}>Guest:</span>
                <span style={{ fontWeight: 600, color: '#0c4a6e' }}>
                  {selectedGuest?.first_name} {selectedGuest?.last_name} ({selectedGuest?.phone})
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span style={{ color: '#64748b' }}>Stay Period:</span>
                <span style={{ fontWeight: 600 }}>
                  {checkInStr} to {checkOutStr} ({nightsCount} {nightsCount === 1 ? 'night' : 'nights'})
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span style={{ color: '#64748b' }}>Booking Source:</span>
                <span>{bookingSource}</span>
              </div>

              <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                  Assigned Kubos & Nightly Breakdown:
                </span>
                {selectedKubos.map((kubo) => {
                  const nightlyRate = Number(kubo.price_per_night);
                  const subtotal = nightlyRate * nightsCount;
                  return (
                    <div key={kubo.kubo_id} className={styles.summaryRow} style={{ marginBottom: 4 }}>
                      <span>
                        Kubo {kubo.kubo_number} ({kubo.type_name}) — {formatCurrency(nightlyRate)} × {nightsCount} nights
                      </span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
                    </div>
                  );
                })}
              </div>

              <div className={styles.summaryTotalRow}>
                <span>Total Accommodation Charges:</span>
                <span className={styles.totalPrice}>{formatCurrency(accommodationTotal)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation Actions */}
      <div className={styles.footerActions}>
        <Button onClick={handleClose}>Cancel</Button>
        <div style={{ display: 'flex', gap: 8 }}>
          {currentStep > 0 && (
            <Button icon={<ArrowLeftOutlined aria-hidden="true" />} onClick={handleBack}>
              Previous
            </Button>
          )}
          {currentStep < 3 && (
            <Button
              type="primary"
              onClick={handleNext}
              disabled={
                (currentStep === 0 && !canProceedStep0) ||
                (currentStep === 1 && !canProceedStep1) ||
                (currentStep === 2 && !canProceedStep2)
              }
            >
              <span>Next</span>
              <ArrowRightOutlined aria-hidden="true" />
            </Button>
          )}
          {currentStep === 3 && (
            <Button
              type="primary"
              loading={createMutation.isPending}
              onClick={handleFinishBooking}
              style={{ background: '#0284c7', borderColor: '#0284c7', fontWeight: 600 }}
            >
              Confirm & Create Reservation
            </Button>
          )}
        </div>
      </div>

      {/* Modal to register guest inline if not found */}
      <GuestForm
        open={isRegisterGuestOpen}
        onCancel={() => setIsRegisterGuestOpen(false)}
        onSubmit={async (values) => {
          const res = await apiClient.post<{ guests: Guest }>('/guests', values as CreateGuestDTO);
          const raw = res as unknown as { guests: Guest };
          if (raw?.guests) {
            setSelectedGuest(raw.guests);
          }
          setIsRegisterGuestOpen(false);
        }}
      />
    </Modal>
  );
};
