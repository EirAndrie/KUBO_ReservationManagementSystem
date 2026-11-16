import { useQueryClient } from '@tanstack/react-query';
import { useAppMutation } from '@/hooks/use-app-mutation.hook';
import { reservationService } from '../services/reservation.service';
import { reservationKeys } from './use-reservations.hook';
import { guestKeys } from '@/features/guest';
import type {
  CreateReservationDTO,
  UpdateReservationDTO,
  CancelReservationDTO,
  BookingSource,
} from '../types/reservation.types';

/**
 * Hook to create a new reservation with kubo assignments.
 */
export function useCreateReservation() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: (data: CreateReservationDTO) => reservationService.create(data),
    successMessage: (created) =>
      `Reservation ${created.reference_code} created successfully for ${created.guest_name}.`,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
      // Guest list stays, Returning badge, and delete eligibility.
      queryClient.invalidateQueries({ queryKey: guestKeys.stayStatsAll() });
      queryClient.invalidateQueries({ queryKey: ['check-in-out'] });
    },
  });
}

/**
 * Hook to update a reservation's header (guest, booking source).
 */
export function useUpdateReservation() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateReservationDTO }) =>
      reservationService.update(id, data),
    successMessage: (updated) =>
      `Reservation ${updated.reference_code} updated successfully.`,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
      // Guest list stays, Returning badge, and delete eligibility.
      queryClient.invalidateQueries({ queryKey: guestKeys.stayStatsAll() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(updated.reservation_id) });
      queryClient.invalidateQueries({ queryKey: ['check-in-out'] });
    },
  });
}

export interface EditReservationInput {
  reservationId: string;
  /** Set only when the booking source changed. */
  bookingSource?: BookingSource;
  /** One entry per assignment whose dates or kubo changed. */
  assignmentChanges: Array<{
    oldKuboId: string;
    checkInDate: string;
    checkOutDate: string;
    /** Set when the assignment moves to a different kubo. */
    newKuboId?: string;
  }>;
}

/**
 * Hook to edit a reservation before check-in (BR-037): booking source, assignment
 * dates, or the assigned kubo. Steps run one after another and stop at the first
 * failure, so the server message is shown and nothing later is attempted. A kubo
 * change is "add the new assignment, then remove the old one" so the reservation
 * never ends up with no kubo.
 */
export function useEditReservation() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: async ({ reservationId, bookingSource, assignmentChanges }: EditReservationInput) => {
      for (const c of assignmentChanges) {
        if (c.newKuboId) {
          await reservationService.assignKubo(reservationId, {
            kuboId: c.newKuboId,
            checkInDate: c.checkInDate,
            checkOutDate: c.checkOutDate,
          });
          await reservationService.removeAssignment(reservationId, c.oldKuboId);
        } else {
          await reservationService.updateAssignment(reservationId, c.oldKuboId, {
            checkInDate: c.checkInDate,
            checkOutDate: c.checkOutDate,
          });
        }
      }
      if (bookingSource) await reservationService.update(reservationId, { bookingSource });
      return reservationId;
    },
    successMessage: 'Reservation updated.',
    onSettled: (_data, _error, vars) => {
      // Refresh even on failure: earlier steps may already have been applied.
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
      // Guest list stays, Returning badge, and delete eligibility.
      queryClient.invalidateQueries({ queryKey: guestKeys.stayStatsAll() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(vars.reservationId) });
      queryClient.invalidateQueries({ queryKey: ['available-kubos'] });
      queryClient.invalidateQueries({ queryKey: ['kubos'] });
    },
  });
}

/**
 * Hook to confirm a pending reservation.
 */
export function useConfirmReservation() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: (reservationId: string) => reservationService.confirm(reservationId),
    successMessage: (confirmed) =>
      `Reservation ${confirmed.reference_code} confirmed successfully.`,
    onSuccess: (confirmed) => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
      // Guest list stays, Returning badge, and delete eligibility.
      queryClient.invalidateQueries({ queryKey: guestKeys.stayStatsAll() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(confirmed.reservation_id) });
      queryClient.invalidateQueries({ queryKey: ['check-in-out'] });
    },
  });
}

/**
 * Hook to cancel a reservation with reason (BR-035).
 */
export function useCancelReservation() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: ({ id, data }: { id: string; data: CancelReservationDTO }) =>
      reservationService.cancel(id, data),
    successMessage: (cancelled) =>
      `Reservation ${cancelled.reference_code} cancelled.`,
    onSuccess: (cancelled) => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
      // Guest list stays, Returning badge, and delete eligibility.
      queryClient.invalidateQueries({ queryKey: guestKeys.stayStatsAll() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(cancelled.reservation_id) });
      queryClient.invalidateQueries({ queryKey: ['check-in-out'] });
    },
  });
}

/**
 * Hook to mark a confirmed reservation as No Show.
 */
export function useMarkNoShow() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: (reservationId: string) => reservationService.markNoShow(reservationId),
    successMessage: (res) =>
      `Reservation ${res.reference_code} marked as No Show.`,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
      // Guest list stays, Returning badge, and delete eligibility.
      queryClient.invalidateQueries({ queryKey: guestKeys.stayStatsAll() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(res.reservation_id) });
      queryClient.invalidateQueries({ queryKey: ['check-in-out'] });
    },
  });
}

/**
 * Hook to hard-delete a reservation (admin repair only).
 */
export function useDeleteReservation() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: (reservationId: string) => reservationService.delete(reservationId),
    successMessage: 'Reservation deleted permanently.',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
      // Guest list stays, Returning badge, and delete eligibility.
      queryClient.invalidateQueries({ queryKey: guestKeys.stayStatsAll() });
      queryClient.invalidateQueries({ queryKey: ['check-in-out'] });
    },
  });
}
