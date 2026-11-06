import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { App } from 'antd';

export interface AppMutationOptions<TData, TVariables, TContext = unknown>
  extends Omit<UseMutationOptions<TData, Error, TVariables, TContext>, 'mutationFn'> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  successMessage?: string | ((data: TData) => string);
  errorMessage?: string | ((error: Error) => string);
}

/**
 * Standardized wrapper around TanStack Query's useMutation.
 * Shows a themed toast on success and failure. Server error messages are shown
 * verbatim unless the caller supplies its own `errorMessage`.
 */
export function useAppMutation<TData = unknown, TVariables = void, TContext = unknown>(
  options: AppMutationOptions<TData, TVariables, TContext>
): UseMutationResult<TData, Error, TVariables, TContext> {
  const { successMessage, errorMessage, onSuccess, onError, ...restOptions } = options;
  const { message } = App.useApp();

  return useMutation<TData, Error, TVariables, TContext>({
    ...restOptions,
    onSuccess: (...args) => {
      const [data] = args;
      if (successMessage) {
        const text =
          typeof successMessage === 'function' ? successMessage(data) : successMessage;
        message.success(text);
      }
      onSuccess?.(...args);
    },
    onError: (...args) => {
      const [error] = args;
      const fallbackMsg =
        error?.message || 'An error occurred while executing the operation.';
      const text =
        typeof errorMessage === 'function'
          ? errorMessage(error)
          : (errorMessage || fallbackMsg);
      message.error(text);
      onError?.(...args);
    },
  });
}
