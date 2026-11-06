import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAppMutation } from '@/hooks/use-app-mutation.hook';
import { paymentService } from '../services/payment.service';
import { reservationKeys } from '@/features/reservation';
import type {
  Payment,
  AdditionalCharge,
  ChargeRequest,
  PaymentStatus,
  CreatePaymentPayload,
  CreateRefundPayload,
  ApplyCatalogChargePayload,
  CreateChargeRequestPayload,
} from '../types/payment.types';

/** Everything that shows money or charge state for a reservation. */
function invalidateMoney(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['payments'] });
  queryClient.invalidateQueries({ queryKey: ['additional-charges'] });
  queryClient.invalidateQueries({ queryKey: ['additional-charge-requests'] });
  queryClient.invalidateQueries({ queryKey: reservationKeys.all });
  queryClient.invalidateQueries({ queryKey: ['check-in-out'] });
}

/**
 * Records a payment (created Pending by the server). When `complete` is set,
 * the payment is then marked Completed so it counts toward the balance.
 * The server rejects amounts above the outstanding balance.
 */
export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useAppMutation<Payment, CreatePaymentPayload & { complete?: boolean }>({
    mutationFn: async ({ complete, ...payload }) => {
      const created = await paymentService.create(payload);
      return complete ? paymentService.updateStatus(created.payment_id, 'Completed') : created;
    },
    successMessage: (p) => (p.payment_status === 'Completed' ? 'Payment recorded.' : 'Payment recorded as pending.'),
    onSuccess: () => invalidateMoney(queryClient),
  });
}

/** Moves a payment to a new status; only transitions the backend allows succeed. */
export function useUpdatePaymentStatus() {
  const queryClient = useQueryClient();
  return useAppMutation<Payment, { paymentId: string; status: PaymentStatus }>({
    mutationFn: ({ paymentId, status }) => paymentService.updateStatus(paymentId, status),
    successMessage: (p) => `Payment marked ${p.payment_status === 'Completed' ? 'completed' : p.payment_status.toLowerCase()}.`,
    onSuccess: () => invalidateMoney(queryClient),
  });
}

/** Refund against a completed payment; the server caps it at net paid. */
export function useIssueRefund() {
  const queryClient = useQueryClient();
  return useAppMutation<Payment, CreateRefundPayload>({
    mutationFn: (payload) => paymentService.refund(payload),
    successMessage: 'Refund issued.',
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useApplyCatalogCharge() {
  const queryClient = useQueryClient();
  return useAppMutation<AdditionalCharge, ApplyCatalogChargePayload>({
    mutationFn: (payload) => paymentService.applyCatalogCharge(payload),
    successMessage: 'Charge added.',
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useCreateChargeRequest() {
  const queryClient = useQueryClient();
  return useAppMutation<ChargeRequest, CreateChargeRequestPayload>({
    mutationFn: (payload) => paymentService.createChargeRequest(payload),
    successMessage: 'Charge request sent for approval.',
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useDeleteCharge() {
  const queryClient = useQueryClient();
  return useAppMutation<void, string>({
    mutationFn: (chargeId) => paymentService.deleteCharge(chargeId),
    successMessage: 'Charge removed.',
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useApproveChargeRequest() {
  const queryClient = useQueryClient();
  return useAppMutation<void, { requestId: string; approvedUnitAmount?: number; reason?: string }>({
    mutationFn: ({ requestId, ...body }) => paymentService.approveChargeRequest(requestId, body),
    successMessage: 'Charge request approved.',
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useRejectChargeRequest() {
  const queryClient = useQueryClient();
  return useAppMutation<void, { requestId: string; reason: string }>({
    mutationFn: ({ requestId, reason }) => paymentService.rejectChargeRequest(requestId, reason),
    successMessage: 'Charge request rejected.',
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useWithdrawChargeRequest() {
  const queryClient = useQueryClient();
  return useAppMutation<void, string>({
    mutationFn: (requestId) => paymentService.withdrawChargeRequest(requestId),
    successMessage: 'Charge request withdrawn.',
    onSuccess: () => invalidateMoney(queryClient),
  });
}
