import { useQueryClient } from '@tanstack/react-query';
import { useAppMutation } from '@/hooks/use-app-mutation.hook';
import { reservationKeys } from '@/features/reservation';
import { checkInOutService } from '../services/check-in-out.service';
import { checkInOutKeys } from './use-check-in-out.hook';
import { formatMoney } from '@/lib/format';
import type { CheckInOutActionParams } from '../types/check-in-out.types';

/**
 * The guest list's stay stats (`guestKeys.stayStatsAll()` in the guest feature).
 * Check-in and check-out change `last_stay` and the Returning badge. The key is
 * written out, like `['kubos']` below, so this feature does not import the guest
 * barrel and add another cross-feature cycle.
 */
const GUEST_STAY_STATS_KEY = ['guests', 'stay-stats'] as const;

/**
 * Applied additional charges (`paymentKeys.charges(reservationId)` in the payment
 * feature). Check-in adds an `EarlyCheckIn` fee and check-out a `LateCheckOut` fee,
 * so the reservation page's charges table must refetch. Written out for the same
 * reason as the key above.
 */
const ADDITIONAL_CHARGES_KEY = ['additional-charges'] as const;

/**
 * Mutation hook to check in a reserved kubo assignment (BR-058, BR-060).
 */
export function useCheckInKubo() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: ({ reservationId, kuboId }: CheckInOutActionParams) =>
      checkInOutService.checkInKubo(reservationId, kuboId),
    successMessage: 'Guest checked in. The kubo is now occupied.',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkInOutKeys.operationalQueue() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['kubos'] });
      queryClient.invalidateQueries({ queryKey: GUEST_STAY_STATS_KEY });
      queryClient.invalidateQueries({ queryKey: ADDITIONAL_CHARGES_KEY });
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
    successMessage: 'Early check-in approved.',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkInOutKeys.operationalQueue() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['kubos'] });
      queryClient.invalidateQueries({ queryKey: GUEST_STAY_STATS_KEY });
      queryClient.invalidateQueries({ queryKey: ADDITIONAL_CHARGES_KEY });
    },
  });
}

/**
 * Mutation hook to mark one never-checked-in assignment as NoShow after its
 * stay dates have passed (issue #67).
 */
export function useMarkKuboNoShow() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: ({ reservationId, kuboId }: CheckInOutActionParams) =>
      checkInOutService.markKuboNoShow(reservationId, kuboId),
    successMessage: 'Kubo marked as no-show.',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkInOutKeys.operationalQueue() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['kubos'] });
      queryClient.invalidateQueries({ queryKey: GUEST_STAY_STATS_KEY });
      queryClient.invalidateQueries({ queryKey: ADDITIONAL_CHARGES_KEY });
    },
  });
}

/**
 * Mutation hook to check out a reserved kubo assignment (BR-062, BR-063).
 * Kubo is transitioned to 'Cleaning'.
 *
 * Past 12:00 on the check-out date a late fee applies (issue #107). If it is not
 * on the bill yet, this puts it there and stops with a message instead of checking
 * out, because the zero-balance rule means the guest must pay it first. Once the
 * balance is settled, running it again checks the guest out.
 */
export function useCheckOutKubo() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationFn: async ({ reservationId, kuboId }: CheckInOutActionParams) => {
      const fees = await checkInOutService.getTimeFees(reservationId, kuboId);
      if (fees.late_hours > 0 && !fees.late_applied) {
        const fee = await checkInOutService.applyLateCheckOutFee(reservationId, kuboId);
        throw new Error(
          `A late check-out fee of ${formatMoney(fee.amount)} (${fee.hours} h past 12:00) was added to the bill. ` +
            'Collect the balance, then check out.',
        );
      }
      await checkInOutService.checkOutKubo(reservationId, kuboId);
    },
    successMessage: 'Guest checked out. The kubo is marked for cleaning.',
    // Also refresh after the "fee added" stop, so the new balance shows.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: checkInOutKeys.operationalQueue() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['kubos'] });
      queryClient.invalidateQueries({ queryKey: GUEST_STAY_STATS_KEY });
      queryClient.invalidateQueries({ queryKey: ADDITIONAL_CHARGES_KEY });
    },
  });
}
