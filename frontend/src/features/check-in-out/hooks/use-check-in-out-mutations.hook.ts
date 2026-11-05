import { useQueryClient } from '@tanstack/react-query';
import { useAppMutation } from '@/hooks/use-app-mutation.hook';
import { reservationKeys } from '@/features/reservation';
import { checkInOutService } from '../services/check-in-out.service';
import { checkInOutKeys } from './use-check-in-out.hook';
import type { CheckInOutActionParams, RecordPaymentPayload } from '../types/check-in-out.types';

/**
 * Mutation hook to check in a reserved kubo assignment (BR-058, BR-060).
 */
export function useCheckInKubo() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: ({ reservationId, kuboId }: CheckInOutActionParams) =>
      checkInOutService.checkInKubo(reservationId, kuboId),
    successMessage: 'Guest checked in successfully. Kubo unit is now Occupied (BR-060).',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkInOutKeys.operationalQueue() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['kubos'] });
    },
  });
}

/**
 * Mutation hook to approve early check-in (BR-059).
 */
export function useApproveEarlyCheckIn() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: ({ reservationId, kuboId }: CheckInOutActionParams) =>
      checkInOutService.approveEarlyCheckIn(reservationId, kuboId),
    successMessage: 'Early check-in approved (BR-059). Proceeding with check-in...',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkInOutKeys.operationalQueue() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
  });
}

/**
 * Mutation hook to check out a reserved kubo assignment (BR-062, BR-063).
 * Kubo is transitioned to 'Cleaning'.
 */
export function useCheckOutKubo() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: ({ reservationId, kuboId }: CheckInOutActionParams) =>
      checkInOutService.checkOutKubo(reservationId, kuboId),
    successMessage: 'Check-out completed. Kubo unit marked for Cleaning (BR-063).',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkInOutKeys.operationalQueue() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['kubos'] });
    },
  });
}

/**
 * Mutation hook to record a final balance payment before departure (BR-064).
 */
export function useRecordFinalPayment() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: (data: RecordPaymentPayload) => checkInOutService.recordPayment(data),
    successMessage: 'Payment recorded successfully. Balance settled (BR-064).',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkInOutKeys.operationalQueue() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
  });
}
