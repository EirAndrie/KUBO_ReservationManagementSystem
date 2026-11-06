/**
 * Public barrel export for the Kubo Type feature module.
 *
 * In accordance with the frontend architecture (docs/frontend-architecture.md),
 * all external features and consumer modules must import exclusively through this entrypoint.
 * Direct access to internal paths (/components, /hooks, /services) from outside this module is prohibited.
 */

// Pages
export { KuboTypeListPage } from './pages/kubo-type-list.page';

// Components
export { KuboTypeDrawer } from './components/kubo-type-drawer.component';
export type { KuboTypeDrawerProps } from './components/kubo-type-drawer.component';

// Hooks
export { useKuboTypes, useKuboType, kuboTypeKeys } from './hooks/use-kubo-types.hook';
export {
  useCreateKuboType,
  useUpdateKuboType,
  useDeleteKuboType,
} from './hooks/use-kubo-type-mutations.hook';

// Services
export { kuboTypeService } from './services/kubo-type.service';

// Types & DTOs
export type {
  KuboType,
  KuboTypeFilterParams,
  CreateKuboTypeDTO,
  UpdateKuboTypeDTO,
  KuboTypesApiResponse,
  SingleKuboTypeApiResponse,
} from './types/kubo-type.types';

// Constants
export {
  KUBO_TYPE_LIMITS,
  CURRENCY,
  KUBO_TYPE_POLICIES,
} from './constants/kubo-type.constants';
