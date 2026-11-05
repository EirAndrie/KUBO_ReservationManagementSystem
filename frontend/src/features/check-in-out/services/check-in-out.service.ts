import { apiClient } from '@/lib/api';
import { reservationService, type Reservation } from '@/features/reservation';
import type { RecordPaymentPayload } from '../types/check-in-out.types';

export const checkInOutService = {
  /**
   * Checks in a reserved kubo assignment (BR-058, BR-060).
   * Updates kubo unit to 'Occupied' and assignment to 'CheckedIn'.
   */
  checkInKubo: async (reservationId: string, kuboId: string): Promise<void> => {
    await apiClient.patch(`/reservations/${reservationId}/kubos/${kuboId}/check-in`);
  },

  /**
   * Approves early check-in before check_in_date (BR-059).
   */
  approveEarlyCheckIn: async (reservationId: string, kuboId: string): Promise<void> => {
    await apiClient.patch(`/reservations/${reservationId}/kubos/${kuboId}/early-check-in`);
  },

  /**
   * Checks out a reserved kubo assignment (BR-062, BR-063).
   * Verifies balance is 0 (BR-064) and transitions kubo unit to 'Cleaning'.
   */
  checkOutKubo: async (reservationId: string, kuboId: string): Promise<void> => {
    await apiClient.patch(`/reservations/${reservationId}/kubos/${kuboId}/check-out`);
  },

  /**
   * Records a payment transaction under a reservation (BR-064).
   */
  recordPayment: async (data: RecordPaymentPayload): Promise<void> => {
    await apiClient.post(`/reservations/${data.reservationId}/payments`, data);
  },

  /**
   * Fetches active reservations for operational arrival/departure queue.
   */
  getActiveReservations: async (): Promise<Reservation[]> => {
    return reservationService.getAll({ limit: 100 });
  },
};
