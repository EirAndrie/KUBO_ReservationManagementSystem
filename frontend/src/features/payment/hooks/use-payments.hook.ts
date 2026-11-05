import { useQuery } from '@tanstack/react-query';
import { paymentService } from '../services/payment.service';
import type { Payment, AdditionalCharge, PaymentFilterParams } from '../types/payment.types';

export const paymentKeys = {
  all: ['payments'] as const,
  lists: () => [...paymentKeys.all, 'list'] as const,
  list: (filters?: PaymentFilterParams) => [...paymentKeys.lists(), filters ?? {}] as const,
  byReservation: (reservationId: string) => [...paymentKeys.all, 'reservation', reservationId] as const,
  charges: (reservationId: string) => ['additional-charges', 'reservation', reservationId] as const,
};

/**
 * Hook to retrieve the global financial payments ledger.
 */
export function usePayments(filters?: PaymentFilterParams) {
  return useQuery<Payment[], Error>({
    queryKey: paymentKeys.list(filters),
    queryFn: () => paymentService.getAll(filters),
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to retrieve all payment records for a specific reservation.
 */
export function useReservationPayments(reservationId: string) {
  return useQuery<Payment[], Error>({
    queryKey: paymentKeys.byReservation(reservationId),
    queryFn: () => paymentService.getByReservation(reservationId),
    enabled: Boolean(reservationId),
    staleTime: 1000 * 15,
  });
}

/**
 * Hook to retrieve all additional charges for a specific reservation.
 */
export function useReservationCharges(reservationId: string) {
  return useQuery<AdditionalCharge[], Error>({
    queryKey: paymentKeys.charges(reservationId),
    queryFn: () => paymentService.getChargesByReservation(reservationId),
    enabled: Boolean(reservationId),
    staleTime: 1000 * 15,
  });
}
