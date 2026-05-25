import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getCookie('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // Only force a logout when the auth endpoint itself rejects the token.
    // A 401 from any other endpoint is surfaced to the caller without
    // wiping the cookie, so one failing background poll can't kick the
    // user back to /login mid-flow.
    const status = err.response?.status;
    const url: string = err.config?.url ?? '';
    if (status === 401 && url.startsWith('/auth') && typeof window !== 'undefined') {
      deleteCookie('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const v = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
  return v ? v.pop() : undefined;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export default api;
