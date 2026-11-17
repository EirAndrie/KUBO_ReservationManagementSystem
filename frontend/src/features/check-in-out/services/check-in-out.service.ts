import { apiClient } from '@/lib/api';
import { reservationService, type Reservation } from '@/features/reservation';
import type { TimeFees } from '../types/check-in-out.types';

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
   * Early check-in and late check-out fees for one kubo (issue #107). The server
   * computes them from its own clock; nothing is calculated in the browser.
   */
  getTimeFees: async (reservationId: string, kuboId: string): Promise<TimeFees> => {
    const body = (await apiClient.get(
      `/reservations/${reservationId}/kubos/${kuboId}/time-fees`,
    )) as unknown as { timeFees: TimeFees };
    return body.timeFees;
  },

  /**
   * Puts the late check-out fee on the bill. Idempotent: calling it again returns
   * the fee already applied. The balance rule then makes the guest settle it.
   */
  applyLateCheckOutFee: async (
    reservationId: string,
    kuboId: string,
  ): Promise<{ hours: number; amount: string }> => {
    const body = (await apiClient.post(
      `/reservations/${reservationId}/kubos/${kuboId}/late-check-out-fee`,
    )) as unknown as { lateFee: { hours: number; amount: string } };
    return body.lateFee;
  },

  /**
   * Total late check-out fee that is due but not yet on the bill for these kubos,
   * for the confirm dialog shown before check-out. Returns 0 when the preview
   * cannot be loaded; the server still enforces the fee at check-out.
   */
  getPendingLateFee: async (reservationId: string, kuboIds: string[]): Promise<number> => {
    try {
      const all = await Promise.all(kuboIds.map((id) => checkInOutService.getTimeFees(reservationId, id)));
      return all.reduce((sum, f) => (f.late_hours > 0 && !f.late_applied ? sum + Number(f.late_fee) : sum), 0);
    } catch {
      return 0;
    }
  },

  /**
   * Marks a never-checked-in assignment as NoShow once its stay dates have
   * passed (issue #67, BR-036/BR-063). Closes the reservation when no
   * assignment is left open; the balance must then be zero (BR-064).
   */
  markKuboNoShow: async (reservationId: string, kuboId: string): Promise<void> => {
    await apiClient.patch(`/reservations/${reservationId}/kubos/${kuboId}/no-show`);
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
