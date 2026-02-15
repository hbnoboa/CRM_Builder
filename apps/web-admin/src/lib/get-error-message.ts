import { AxiosError } from 'axios';

/**
 * Extracts a human-readable error message from an unknown error.
 * Handles AxiosError (API responses), standard Error, and unknown types.
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.message || error.message || fallback || 'Error';
  }
  if (error instanceof Error) {
    return error.message || fallback || 'Error';
  }
  return fallback || 'Error';
}
