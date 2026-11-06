import { apiClient } from '@/lib/api';
import { reservationService, type Reservation } from '@/features/reservation';

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
   * Fetches active reservations for operational arrival/departure queue.
   */
  getActiveReservations: async (): Promise<Reservation[]> => {
    const [confirmed, checkedIn] = await Promise.all([
      reservationService.getAll({ status: 'Confirmed', limit: 100 }),
      reservationService.getAll({ status: 'CheckedIn', limit: 100 }),
    ]);
    return [...confirmed, ...checkedIn];
  },
};
