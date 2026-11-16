/**
 * On-demand entry for `React.lazy`. The payment barrel (`index.ts`) is part of
 * the app shell's startup graph (charge-request hooks in the sidebar and top
 * bar), so lazy-importing the barrel would pull the page into the first load.
 * Only lazy imports may use this file; everything else imports from `index.ts`.
 */
export { PaymentListPage } from './pages/payment-list.page';
