const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ApiFetchOptions extends RequestInit {
  token?: string | null;
}

export const apiFetch = async <T,>(path: string, options: ApiFetchOptions = {}): Promise<T> => {
  const { token, headers, ...rest } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const contentType = response.headers.get('content-type');
  const body = contentType?.includes('application/json') ? await response.json() : undefined;

  if (!response.ok) {
    const message = body?.message ?? response.statusText;
    throw new ApiError(response.status, Array.isArray(message) ? message.join(', ') : message);
  }

  return body as T;
};
