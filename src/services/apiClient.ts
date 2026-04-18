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

  // 15-second timeout to handle slow mobile connections without failing instantly
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options?.headers ?? {}) },
      // @ts-ignore - signal is supported in modern fetch
      signal: options?.signal ?? controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let body: unknown;
      try { body = await response.json(); } catch {}
      
      // Special handling for 401 — not a "backend failure", but a logic failure (auth)
      if (response.status === 401) {
        throw new ApiError(401, 'Unauthorized', body);
      }

      throw new ApiError(
        response.status,
        `API Error ${response.status}: ${response.statusText}`,
        body
      );
    }

    // Handle 204 No Content
    if (response.status === 204) return undefined as T;

    return response.json() as Promise<T>;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw err;
  }
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
