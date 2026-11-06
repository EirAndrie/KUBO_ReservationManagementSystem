import axios, { type AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';

/** Error raised by the API client. `status` is the HTTP status when there was a response. */
export interface ApiError extends Error {
  status?: number;
}

/**
 * Global API Client configured for the KUBO backend.
 * The backend mounts every route under `/KUBO_Resort/Management-System/v0.0.1`;
 * set `VITE_API_BASE_URL` in `frontend/.env` (see `.env.example`).
 */
export const apiClient = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:8080/KUBO_Resort/Management-System/v0.0.1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request Interceptor: Attach token if present in localStorage
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token =
      localStorage.getItem('kubo_access_token') ||
      localStorage.getItem('kubo_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response Interceptor: Unwrap response data & standardize error messages
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  (error: AxiosError<{ message?: string; success?: boolean }>) => {
    const status = error.response?.status;
    const responseData = error.response?.data;
    const errorMsg =
      responseData?.message ||
      error.message ||
      'An unexpected server error occurred.';

    // A 401 on sign-in is a wrong password, not an expired session.
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (status === 401 && !isLoginRequest) {
      localStorage.removeItem('kubo_access_token');
      localStorage.removeItem('kubo_token');
      localStorage.removeItem('kubo_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    const apiError: ApiError = new Error(errorMsg);
    apiError.status = status;
    return Promise.reject(apiError);
  }
);

export default apiClient;
