import { apiClient } from '@/lib/api';
import type {
  AuthUser,
  LoginCredentials,
} from '../types/auth.types';

const STORAGE_KEY_TOKEN = 'kubo_access_token';
const STORAGE_KEY_USER = 'kubo_user';

export const authService = {
  /**
   * Performs user authentication against the KUBO backend (BR-003, BR-004).
   *
   * Sends the credentials to the backend /auth/login endpoint.
   * If the backend is unavailable, throws a clear error so the user knows
   * the server must be running — no silent fallback to demo accounts.
   *
   * Business rules:
   * - Password must be 6–12 characters (BR-003).
   * - Only employees with status "Active" may sign in (BR-004).
   *
   * @param credentials - Username and password submitted from the login form.
   * @returns The authenticated user object with role and token.
   * @throws {Error} When credentials are invalid, the account is inactive, or the server is unreachable.
   */
  login: async (credentials: LoginCredentials): Promise<AuthUser> => {
    const trimmedUsername = credentials.username.trim().toLowerCase();
    const password = credentials.password;

    // Validate password length rule (BR-003: 6-12 chars)
    if (password.length < 6 || password.length > 12) {
      throw new Error('Password must be between 6 and 12 characters (BR-003).');
    }

    try {
      const response = await apiClient.post('/auth/login', {
        username: trimmedUsername,
        password,
      }) as unknown as { user?: AuthUser };

      if (!response.user) {
        throw new Error('The server returned an invalid sign-in response.');
      }

      authService.setSession(response.user);
      return response.user;
    } catch (err: unknown) {
      const message = (err as Error)?.message || '';
      if (message === 'Network Error' || message.toLowerCase().includes('timeout')) {
        throw new Error(
          'Unable to reach the server. Please ensure the backend is running and try again.',
          { cause: err }
        );
      }
      throw err;
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
