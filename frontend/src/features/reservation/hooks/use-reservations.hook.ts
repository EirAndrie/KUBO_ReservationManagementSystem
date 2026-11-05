import { useQuery } from '@tanstack/react-query';
import { reservationService } from '../services/reservation.service';
import type { ReservationFilterParams } from '../types/reservation.types';

/**
 * Standardized Query Key Factory for Reservations.
 */
export const reservationKeys = {
  all: ['reservations'] as const,
  lists: () => [...reservationKeys.all, 'list'] as const,
  list: (params?: ReservationFilterParams) => [...reservationKeys.lists(), params] as const,
  details: () => [...reservationKeys.all, 'detail'] as const,
  detail: (id: string) => [...reservationKeys.details(), id] as const,
  availableKubos: (checkIn: string, checkOut: string, kuboTypeId?: string) =>
    ['available-kubos', checkIn, checkOut, kuboTypeId] as const,
  payments: (id: string) => [...reservationKeys.detail(id), 'payments'] as const,
  charges: (id: string) => [...reservationKeys.detail(id), 'charges'] as const,
};

/**
 * Hook to retrieve reservations with optional multi-field filters.
 */
export function useReservations(params?: ReservationFilterParams) {
  return useQuery({
    queryKey: reservationKeys.list(params),
    queryFn: () => reservationService.getAll(params),
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to retrieve a single reservation's complete detail including assignments.
 */
export function useReservation(reservationId?: string) {
  return useQuery({
    queryKey: reservationKeys.detail(reservationId ?? ''),
    queryFn: () => reservationService.getById(reservationId!),
    enabled: Boolean(reservationId),
  });
}

/**
 * Hook to retrieve kubos available for a specific date range.
 * Disabled until both dates are provided.
 */
export function useAvailableKubos(params: {
  checkIn: string;
  checkOut: string;
  kuboTypeId?: string;
}) {
  const enabled = Boolean(params.checkIn && params.checkOut);
  return useQuery({
    queryKey: reservationKeys.availableKubos(params.checkIn, params.checkOut, params.kuboTypeId),
    queryFn: () => reservationService.getAvailableKubos(params),
    enabled,
    staleTime: 1000 * 30, // 30 seconds — availability is volatile
  });
}

/**
 * Hook to retrieve payments recorded for a reservation.
 */
export function useReservationPayments(reservationId?: string) {
  return useQuery({
    queryKey: reservationKeys.payments(reservationId ?? ''),
    queryFn: () => reservationService.getPayments(reservationId!),
    enabled: Boolean(reservationId),
  });
}

/**
 * Hook to retrieve additional charges recorded for a reservation.
 */
export function useReservationCharges(reservationId?: string) {
  return useQuery({
    queryKey: reservationKeys.charges(reservationId ?? ''),
    queryFn: () => reservationService.getCharges(reservationId!),
    enabled: Boolean(reservationId),
  });
}
