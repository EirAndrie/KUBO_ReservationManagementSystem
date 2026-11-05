import { apiClient } from '@/lib/api';
import type {
  Guest,
  GuestFilterParams,
  CreateGuestDTO,
  UpdateGuestDTO,
  GuestsApiResponse,
  SingleGuestApiResponse,
  GuestReservationHistoryItem,
  GuestReservationsApiResponse,
} from '../types/guest.types';

/**
 * Service handling all guest management and reservation-lookup HTTP requests.
 * Pure asynchronous layer with no React dependencies.
 */
export const guestService = {
  /**
   * Retrieves a paginated list of guests with optional name/email/phone search and valid ID type filter.
   */
  getAll: async (params?: GuestFilterParams): Promise<Guest[]> => {
    const queryParams: Record<string, string | number | undefined> = {};
    if (params?.search?.trim()) {
      queryParams.search = params.search.trim();
    }
    if (params?.validIdType) {
      queryParams.validIdType = params.validIdType;
    }
    if (params?.limit) {
      queryParams.limit = params.limit;
    }
    if (params?.offset) {
      queryParams.offset = params.offset;
    }

    const response = await apiClient.get<GuestsApiResponse>('/guests', {
      params: queryParams,
    });
    const raw = response as unknown as GuestsApiResponse | Guest[];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as GuestsApiResponse)?.guests)) {
      return (raw as GuestsApiResponse).guests;
    }
    throw new Error('The server returned an invalid guest list.');
  },

  /**
   * Retrieves a single guest record by its UUID.
   */
  getById: async (guestId: string): Promise<Guest> => {
    const response = await apiClient.get<SingleGuestApiResponse>(`/guests/${guestId}`);
    const raw = response as unknown as SingleGuestApiResponse | Guest;
    if ((raw as SingleGuestApiResponse)?.guests) {
      return (raw as SingleGuestApiResponse).guests;
    }
    if (raw && typeof raw === 'object' && 'guest_id' in raw) return raw as Guest;
    throw new Error('The server returned an invalid guest record.');
  },

  /**
   * Fast lookup search for existing guests, used by autocomplete and debounced Select.
   */
  search: async (searchTerm: string, limit = 10): Promise<Guest[]> => {
    if (!searchTerm.trim()) {
      return [];
    }
    return guestService.getAll({ search: searchTerm.trim(), limit });
  },

  /**
   * Registers a new guest or reuses an existing matching record (BR-013).
   */
  create: async (data: CreateGuestDTO): Promise<{ guest: Guest; reused?: boolean }> => {
    const response = await apiClient.post<SingleGuestApiResponse>('/guests', data);
    const raw = response as unknown as SingleGuestApiResponse;
    if (raw && raw.guests) {
      return {
        guest: raw.guests,
        reused: Boolean(raw.reused),
      };
    }
    return { guest: raw as unknown as Guest, reused: false };
  },

  /**
   * Updates an existing guest's contact, address, or identification details (BR-014).
   */
  update: async (guestId: string, data: UpdateGuestDTO): Promise<Guest> => {
    const response = await apiClient.patch<SingleGuestApiResponse>(`/guests/${guestId}`, data);
    const raw = response as unknown as SingleGuestApiResponse | Guest;
    if ((raw as SingleGuestApiResponse)?.guests) {
      return (raw as SingleGuestApiResponse).guests;
    }
    return raw as Guest;
  },

  /**
   * Deletes an unused guest record (BR-015). Fails if reservations are linked.
   */
  delete: async (guestId: string): Promise<void> => {
    await apiClient.delete(`/guests/${guestId}`);
  },

  /**
   * Retrieves all reservations associated with a given guest UUID.
   */
  getReservations: async (guestId: string): Promise<GuestReservationHistoryItem[]> => {
    const response = await apiClient.get<GuestReservationsApiResponse>('/reservations', {
      params: { guestId },
    });
    const raw = response as unknown as GuestReservationsApiResponse | GuestReservationHistoryItem[];
    if (Array.isArray(raw)) {
      return raw;
    }
    if (Array.isArray((raw as GuestReservationsApiResponse)?.reservations)) {
      return (raw as GuestReservationsApiResponse).reservations;
    }
    throw new Error('The server returned an invalid reservation history.');
  },
};
