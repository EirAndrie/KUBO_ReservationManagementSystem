import { useQueryClient } from '@tanstack/react-query';
import { useAppMutation } from '@/hooks/use-app-mutation.hook';
import { paymentService } from '../services/payment.service';
import { paymentKeys } from './use-payments.hook';
import { reservationKeys } from '@/features/reservation';
import type {
  Payment,
  AdditionalCharge,
  CreatePaymentPayload,
  CreateRefundPayload,
  CreateAdditionalChargePayload,
} from '../types/payment.types';

/**
 * Mutation hook to record a new incoming payment (BR-049, BR-053).
 * Invalidates payment ledger, reservation payments, and reservation details on success.
 */
export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useAppMutation<Payment, CreatePaymentPayload>({
    mutationFn: (payload) => paymentService.create(payload.reservationId, payload),
    successMessage: 'Payment recorded successfully (BR-049).',
    errorMessage: (error) => error.message || 'Failed to record payment.',
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      queryClient.invalidateQueries({ queryKey: paymentKeys.byReservation(variables.reservationId) });
      queryClient.invalidateQueries({ queryKey: paymentKeys.charges(variables.reservationId) });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
  });
}

/**
 * Mutation hook to issue an audited refund against completed payments (BR-054).
 * Refund amount must not exceed net completed payments for the reservation.
 */
export function useIssueRefund() {
  const queryClient = useQueryClient();

  return useAppMutation<Payment, CreateRefundPayload>({
    mutationFn: (payload) => paymentService.refund(payload.reservationId, payload),
    successMessage: 'Refund issued successfully. Audit trail recorded (BR-054).',
    errorMessage: (error) => error.message || 'Failed to issue refund.',
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      queryClient.invalidateQueries({ queryKey: paymentKeys.byReservation(variables.reservationId) });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
  });
}

/**
 * Mutation hook to post an incidental / additional charge (BR-042, BR-046).
 * Settled charges are append-only; corrections via supplementary entries.
 */
export function useAddCharge() {
  const queryClient = useQueryClient();

  return useAppMutation<AdditionalCharge, CreateAdditionalChargePayload>({
    mutationFn: (payload) => paymentService.createCharge(payload.reservationId, payload),
    successMessage: 'Additional charge posted to reservation (BR-042).',
    errorMessage: (error) => error.message || 'Failed to add charge.',
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.charges(variables.reservationId) });
      queryClient.invalidateQueries({ queryKey: paymentKeys.byReservation(variables.reservationId) });
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
  });
}
