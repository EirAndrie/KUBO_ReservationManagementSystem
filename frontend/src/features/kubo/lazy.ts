/**
 * On-demand entry for `React.lazy`. The kubo barrel (`index.ts`) is part of the
 * app shell's startup graph (the Staff sidebar's housekeeping badge), so
 * lazy-importing the barrel would pull every page into the first load. Only
 * lazy imports may use this file; everything else imports from `index.ts`.
 */
export { KuboListPage } from './pages/kubo-list.page';
export { HousekeepingPage } from './pages/housekeeping.page';
