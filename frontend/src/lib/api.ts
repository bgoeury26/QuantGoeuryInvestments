import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getCookie('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      deleteCookie('auth_token');
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
