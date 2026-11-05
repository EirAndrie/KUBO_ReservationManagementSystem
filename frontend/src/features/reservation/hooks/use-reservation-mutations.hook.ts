import { useQueryClient } from '@tanstack/react-query';
import { useAppMutation } from '@/hooks/use-app-mutation.hook';
import { reservationService } from '../services/reservation.service';
import { reservationKeys } from './use-reservations.hook';
import type {
  CreateReservationDTO,
  UpdateReservationDTO,
  CancelReservationDTO,
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
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(updated.reservation_id) });
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
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(confirmed.reservation_id) });
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
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(cancelled.reservation_id) });
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
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(res.reservation_id) });
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
    },
  });
}
