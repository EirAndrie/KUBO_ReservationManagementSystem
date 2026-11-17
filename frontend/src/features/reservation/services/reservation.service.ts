import { apiClient } from '@/lib/api';
import type {
  Reservation,
  ReservationFilterParams,
  CreateReservationDTO,
  UpdateReservationDTO,
  CancelReservationDTO,
  CreateAssignmentDTO,
  ReservationsApiResponse,
  SingleReservationApiResponse,
  AvailableKubo,
  AvailableKubosApiResponse,
  PaymentItem,
  AdditionalChargeItem,
} from '../types/reservation.types';

/** Maps list filters to the `GET /reservations` query string, dropping empty values. */
function toListQuery(params?: ReservationFilterParams) {
  const queryParams: Record<string, string | number | undefined> = {};
  if (params?.status) queryParams.status = params.status;
  if (params?.bookingSource) queryParams.bookingSource = params.bookingSource;
  if (params?.search?.trim()) queryParams.search = params.search.trim();
  if (params?.guestId) queryParams.guestId = params.guestId;
  if (params?.employeeId) queryParams.employeeId = params.employeeId;
  if (params?.checkInDate) queryParams.checkInDate = params.checkInDate;
  if (params?.checkOutDate) queryParams.checkOutDate = params.checkOutDate;
  if (params?.arrivalDate) queryParams.arrivalDate = params.arrivalDate;
  if (params?.stayFrom) queryParams.stayFrom = params.stayFrom;
  if (params?.stayTo) queryParams.stayTo = params.stayTo;
  if (params?.kuboType) queryParams.kuboType = params.kuboType;
  if (params?.sort) queryParams.sort = params.sort;
  if (params?.limit) queryParams.limit = params.limit;
  if (params?.page) queryParams.page = params.page;
  return queryParams;
}

/**
 * Service for all reservation lifecycle and availability HTTP operations.
 * Pure async functions with no React dependencies.
 */
export const reservationService = {
  /**
   * Lists all reservations with optional status, booking source, search, and date filters.
   */
  getAll: async (params?: ReservationFilterParams): Promise<Reservation[]> => {
    const response = await apiClient.get<ReservationsApiResponse>('/reservations', {
      params: toListQuery(params),
    });
    const raw = response as unknown as ReservationsApiResponse | Reservation[];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as ReservationsApiResponse)?.reservations)) {
      return (raw as ReservationsApiResponse).reservations;
    }
    throw new Error('The server returned an invalid reservation list.');
  },

  /**
   * Counts reservations matching the filters across all pages, using the list
   * response's `total` (one-row page; `page`, `limit`, and `sort` are ignored).
   */
  count: async (params?: Omit<ReservationFilterParams, 'page' | 'limit' | 'sort'>): Promise<number> => {
    const response = await apiClient.get<ReservationsApiResponse>('/reservations', {
      params: { ...toListQuery(params), page: 1, limit: 1 },
    });
    const total = (response as unknown as ReservationsApiResponse)?.total;
    if (typeof total !== 'number') throw new Error('The server returned an invalid reservation count.');
    return total;
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
   * Updates the dates of one kubo assignment (BR-037). Allowed only before check-in;
   * overlap is re-validated by the database.
   */
  updateAssignment: async (
    reservationId: string,
    kuboId: string,
    data: { checkInDate: string; checkOutDate: string },
  ): Promise<void> => {
    await apiClient.patch(`/reservations/${reservationId}/kubos/${kuboId}`, data);
  },

  /** Adds a kubo assignment to an existing reservation. */
  assignKubo: async (reservationId: string, data: CreateAssignmentDTO): Promise<void> => {
    await apiClient.post(`/reservations/${reservationId}/kubos`, data);
  },

  /**
   * Replaces a Reserved kubo assignment with another kubo for the same dates in one
   * database transaction; the server validates availability and applies the new rate.
   */
  reassignKubo: async (reservationId: string, kuboId: string, newKuboId: string): Promise<void> => {
    await apiClient.patch(`/reservations/${reservationId}/kubos/${kuboId}/reassign`, { newKuboId });
  },

  /** Removes a not-yet-checked-in kubo assignment from a reservation. */
  removeAssignment: async (reservationId: string, kuboId: string): Promise<void> => {
    await apiClient.delete(`/reservations/${reservationId}/kubos/${kuboId}`);
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
