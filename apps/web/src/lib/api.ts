import axios from 'axios';
import type { AxiosError } from 'axios';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

interface ErrorBody {
  message?: string | string[];
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorBody>) => {
    const status = error.response?.status ?? 0;
    const rawMessage = error.response?.data?.message ?? error.message;
    const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
    return Promise.reject(new ApiError(status, message));
  },
);

export const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });
