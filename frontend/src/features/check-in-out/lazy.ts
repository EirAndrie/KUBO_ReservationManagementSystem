/**
 * On-demand entry for `React.lazy`. The check-in-out barrel (`index.ts`) is part
 * of the app shell's startup graph (the queue hook in the sidebar and top bar),
 * so lazy-importing the barrel would pull the page into the first load. Only
 * lazy imports may use this file; everything else imports from `index.ts`.
 */
export { CheckInOutPage } from './pages/check-in-out.page';
