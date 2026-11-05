import { apiClient } from '@/lib/api';
import type {
  Reservation,
  ReservationFilterParams,
  CreateReservationDTO,
  UpdateReservationDTO,
  CancelReservationDTO,
  ReservationsApiResponse,
  SingleReservationApiResponse,
  AvailableKubo,
  AvailableKubosApiResponse,
  PaymentItem,
  AdditionalChargeItem,
} from '../types/reservation.types';

/**
 * Service for all reservation lifecycle and availability HTTP operations.
 * Pure async functions with no React dependencies.
 */
export const reservationService = {
  /**
   * Lists all reservations with optional status, booking source, search, and date filters.
   */
  getAll: async (params?: ReservationFilterParams): Promise<Reservation[]> => {
    const queryParams: Record<string, string | number | undefined> = {};
    if (params?.status) queryParams.status = params.status;
    if (params?.bookingSource) queryParams.bookingSource = params.bookingSource;
    if (params?.search?.trim()) queryParams.search = params.search.trim();
    if (params?.guestId) queryParams.guestId = params.guestId;
    if (params?.employeeId) queryParams.employeeId = params.employeeId;
    if (params?.checkInDate) queryParams.checkInDate = params.checkInDate;
    if (params?.checkOutDate) queryParams.checkOutDate = params.checkOutDate;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.offset) queryParams.offset = params.offset;

    const response = await apiClient.get<ReservationsApiResponse>('/reservations', {
      params: queryParams,
    });
    const raw = response as unknown as ReservationsApiResponse | Reservation[];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as ReservationsApiResponse)?.reservations)) {
      return (raw as ReservationsApiResponse).reservations;
    }
    throw new Error('The server returned an invalid reservation list.');
  },

  /**
   * Retrieves a single reservation by UUID with full assignment details.
   */
  getById: async (reservationId: string): Promise<Reservation> => {
    const response = await apiClient.get<SingleReservationApiResponse>(
      `/reservations/${reservationId}`,
    );
    const raw = response as unknown as SingleReservationApiResponse | Reservation;
    if ((raw as SingleReservationApiResponse)?.reservations) {
      return (raw as SingleReservationApiResponse).reservations;
    }
    if (raw && typeof raw === 'object' && 'reservation_id' in raw) return raw as Reservation;
    throw new Error('The server returned an invalid reservation record.');
  },

  /**
   * Creates a new reservation with kubo assignments.
   * Overlap detection is enforced atomically by the database (BR-031, BR-032).
   */
  create: async (data: CreateReservationDTO): Promise<Reservation> => {
    const response = await apiClient.post<SingleReservationApiResponse>('/reservations', data);
    const raw = response as unknown as SingleReservationApiResponse | Reservation;
    if ((raw as SingleReservationApiResponse)?.reservations) {
      return (raw as SingleReservationApiResponse).reservations;
    }
    return raw as Reservation;
  },

  /**
   * Updates reservation header fields (guest, booking source).
   */
  update: async (reservationId: string, data: UpdateReservationDTO): Promise<Reservation> => {
    const response = await apiClient.patch<SingleReservationApiResponse>(
      `/reservations/${reservationId}`,
      data,
    );
    const raw = response as unknown as SingleReservationApiResponse | Reservation;
    if ((raw as SingleReservationApiResponse)?.reservations) {
      return (raw as SingleReservationApiResponse).reservations;
    }
    return raw as Reservation;
  },

  /**
   * Transitions reservation status: Pending -> Confirmed.
   */
  confirm: async (reservationId: string): Promise<Reservation> => {
    const response = await apiClient.patch<SingleReservationApiResponse>(
      `/reservations/${reservationId}/confirm`,
    );
    const raw = response as unknown as SingleReservationApiResponse | Reservation;
    if ((raw as SingleReservationApiResponse)?.reservations) {
      return (raw as SingleReservationApiResponse).reservations;
    }
    return raw as Reservation;
  },

  /**
   * Cancels a reservation with a mandatory reason (BR-035).
   */
  cancel: async (reservationId: string, data: CancelReservationDTO): Promise<Reservation> => {
    const response = await apiClient.patch<SingleReservationApiResponse>(
      `/reservations/${reservationId}/cancel`,
      data,
    );
    const raw = response as unknown as SingleReservationApiResponse | Reservation;
    if ((raw as SingleReservationApiResponse)?.reservations) {
      return (raw as SingleReservationApiResponse).reservations;
    }
    return raw as Reservation;
  },

  /**
   * Marks a confirmed reservation as NoShow.
   */
  markNoShow: async (reservationId: string): Promise<Reservation> => {
    const response = await apiClient.patch<SingleReservationApiResponse>(
      `/reservations/${reservationId}/no-show`,
    );
    const raw = response as unknown as SingleReservationApiResponse | Reservation;
    if ((raw as SingleReservationApiResponse)?.reservations) {
      return (raw as SingleReservationApiResponse).reservations;
    }
    return raw as Reservation;
  },

  /**
   * Admin-only hard delete for repair purposes.
   */
  delete: async (reservationId: string): Promise<void> => {
    await apiClient.delete(`/reservations/${reservationId}`);
  },

  /**
   * Queries kubos available for a given date range, with optional type filter.
   * Used by the booking wizard Step 3.
   */
  getAvailableKubos: async (params: {
    checkIn: string;
    checkOut: string;
    kuboTypeId?: string;
  }): Promise<AvailableKubo[]> => {
    const response = await apiClient.get<AvailableKubosApiResponse>('/kubos/available', {
      params,
    });
    const raw = response as unknown as AvailableKubosApiResponse | AvailableKubo[];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as AvailableKubosApiResponse)?.kubos)) {
      return (raw as AvailableKubosApiResponse).kubos;
    }
    throw new Error('The server returned an invalid availability list.');
  },

  /**
   * Fetches payments linked to a reservation.
   */
  getPayments: async (reservationId: string) => {
    const response = await apiClient.get<{ payments?: PaymentItem[] } | PaymentItem[]>(
      `/reservations/${reservationId}/payments`,
    );
    const raw = response as unknown as { payments?: PaymentItem[] } | PaymentItem[];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.payments)) return raw.payments;
    throw new Error('The server returned an invalid payment list.');
  },

  /**
   * Fetches additional charges linked to a reservation.
   */
  getCharges: async (reservationId: string) => {
    const response = await apiClient.get<{ additionalCharges?: AdditionalChargeItem[] } | AdditionalChargeItem[]>(
      `/reservations/${reservationId}/charges`,
    );
    const raw = response as unknown as { additionalCharges?: AdditionalChargeItem[] } | AdditionalChargeItem[];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.additionalCharges)) return raw.additionalCharges;
    throw new Error('The server returned an invalid charge list.');
  },
};
