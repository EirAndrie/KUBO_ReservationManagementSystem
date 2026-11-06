/** Kubo statuses the backend accepts for check-in (`Reserved` = held for this guest). */
export const READY_KUBO_STATUSES = ['Available', 'Reserved'];

/** True when the kubo can be checked into. An unknown status is not treated as blocked. */
export function isKuboReady(status?: string): boolean {
  return !status || READY_KUBO_STATUSES.includes(status);
}
