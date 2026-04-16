/**
 * AlphaAI — API Client
 * Thin fetch wrapper with:
 * - Automatic base URL resolution
 * - Auth token injection (from SecureStore)
 * - JSON serialization / deserialization
 * - Typed error handling
 */
import * as SecureStore from 'expo-secure-store';
import { API } from '@/src/constants/api';

const STORAGE_KEY_ACCESS = 'alphaai_access_token';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getHeaders(): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync(STORAGE_KEY_ACCESS);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API.BASE_URL}${endpoint}`;
  const headers = await getHeaders();

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options?.headers ?? {}) },
  });

  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch {}
    throw new ApiError(
      response.status,
      `API Error ${response.status}: ${response.statusText}`,
      body
    );
  }

  // Handle 204 No Content
  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(endpoint: string): Promise<T> =>
    request<T>(endpoint, { method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown): Promise<T> =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown): Promise<T> =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown): Promise<T> =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string): Promise<T> =>
    request<T>(endpoint, { method: 'DELETE' }),
};
