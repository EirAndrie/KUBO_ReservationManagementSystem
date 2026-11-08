import { apiClient } from '@/lib/api';
import type {
  AuthUser,
  EmployeeStatus,
  LoginCredentials,
} from '../types/auth.types';
import { toUserRole } from '../utils/role.utils';

/** Shape of `POST /auth/login` (see backend auth.controllers.ts). */
interface LoginResponse {
  accessToken: string;
  tokenType: string;
  employee: {
    employeeId: string;
    roleId: string;
    roleName: string;
    firstName: string;
    lastName: string;
    username: string;
    status: string;
  };
}

/**
 * Maps the backend's `employee` + `accessToken` into the app's `AuthUser`.
 *
 * Role names are canonical lowercase values; an unsupported name throws so the
 * sign-in is blocked instead of silently granting Staff access.
 */
function toAuthUser(employee: LoginResponse['employee'], accessToken: string): AuthUser {
  const role = toUserRole(employee.roleName);
  return {
    employeeId: employee.employeeId,
    username: employee.username,
    firstName: employee.firstName,
    lastName: employee.lastName,
    fullName: `${employee.firstName} ${employee.lastName}`.trim() || employee.username,
    role,
    status: employee.status as EmployeeStatus,
    token: accessToken,
  };
}

const STORAGE_KEY_TOKEN = 'kubo_access_token';
const STORAGE_KEY_USER = 'kubo_user';

export const authService = {
  /**
   * Signs in against `POST /auth/login` (BR-003, BR-004).
   *
   * The backend answers `{ accessToken, tokenType, employee }`; the employee
   * and token are mapped into an `AuthUser` and stored. Wrong credentials
   * (401) and inactive accounts (403) surface the server's message verbatim.
   *
   * @throws {Error} When credentials are invalid, the account is not active,
   *   or the server cannot be reached.
   */
  login: async (credentials: LoginCredentials): Promise<AuthUser> => {
    const username = credentials.username.trim().toLowerCase();
    const password = credentials.password;

    if (password.length < 6 || password.length > 12) {
      throw new Error('Password must be 6 to 12 characters.');
    }

    try {
      const response = (await apiClient.post('/auth/login', { username, password })) as unknown as LoginResponse;

      if (!response?.accessToken || !response.employee) {
        throw new Error('The server returned an invalid sign-in response.');
      }

      const user = toAuthUser(response.employee, response.accessToken);
      authService.setSession(user);
      return user;
    } catch (err: unknown) {
      const message = (err as Error)?.message || '';
      if (message === 'Network Error' || message.toLowerCase().includes('timeout')) {
        throw new Error('Server unreachable. Check that the backend is running, then try again.', { cause: err });
      }
      throw err;
    }
  },

  /**
   * Best-effort audit of the sign-out (`POST /auth/logout`). The session is
   * cleared locally whether or not the request succeeds.
   */
  logoutRemote: async (): Promise<void> => {
    // Read the token now: the caller clears storage right after this starts.
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (!token) return;
    try {
      await apiClient.post('/auth/logout', undefined, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // Tokens are stateless; a failed audit call must not block sign-out.
    }
  },

  /**
   * Stores user session in localStorage.
   */
  setSession: (user: AuthUser): void => {
    localStorage.setItem(STORAGE_KEY_TOKEN, user.token);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  },

  /**
   * Retrieves current authenticated user from storage.
   */
  getCurrentUser: (): AuthUser | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER);
      if (!stored) return null;
      return JSON.parse(stored) as AuthUser;
    } catch {
      return null;
    }
  },

  /**
   * Clears session and tokens on logout.
   */
  logout: (): void => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem('kubo_token');
    localStorage.removeItem(STORAGE_KEY_USER);
  },
};
