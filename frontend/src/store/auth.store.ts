import { create } from 'zustand';
import api from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  isAdmin: boolean;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const v = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
  return v ? v.pop() ?? null : null;
}

function setCookie(name: string, value: string, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,

  setUser: (user) => set({ user }),

  setToken: (token) => {
    set({ token });
    if (token) {
      setCookie('access_token', token);
    } else {
      deleteCookie('access_token');
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { access_token, user } = res.data;
      setCookie('access_token', access_token);
      set({ token: access_token, user });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (name: string, email: string, password: string) => {
    set({ isLoading: true });
    try {
      await api.post('/auth/register', { name, email, password });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    deleteCookie('access_token');
    set({ user: null, token: null });
    window.location.href = '/login';
  },

  fetchMe: async () => {
    const token = getCookie('access_token');
    if (!token) return;
    try {
      set({ isLoading: true });
      const res = await api.get('/auth/me');
      set({ user: res.data, token });
    } catch (_) {
      deleteCookie('access_token');
      set({ user: null, token: null });
    } finally {
      set({ isLoading: false });
    }
  },
}));
