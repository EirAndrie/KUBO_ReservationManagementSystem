import axios, { type AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { message } from 'antd';

/**
 * Global API Client configured for the KUBO backend.
 * Uses environment variables for baseURL and supports JWT token injection.
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 3000,
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

    if (status === 401) {
      localStorage.removeItem('kubo_access_token');
      localStorage.removeItem('kubo_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (status === 403) {
      message.error(errorMsg || 'Access denied: You do not have permission.');
    }

    return Promise.reject(new Error(errorMsg));
  }
);

export default apiClient;
