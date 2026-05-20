import { create } from 'zustand';
import Cookies from 'js-cookie';
import api from '@/lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: Cookies.get('access_token') || null,
  isLoading: false,
  isAuthenticated: false,

  login: async (email, password) => {
    set({ isLoading: true });
    const { data } = await api.post('/auth/login', { email, password });
    Cookies.set('access_token', data.access_token, { expires: 7, secure: true, sameSite: 'strict' });
    set({ token: data.access_token, user: data.user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    Cookies.remove('access_token');
    set({ user: null, token: null, isAuthenticated: false });
    window.location.href = '/login';
  },

  fetchMe: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true });
    await api.post('/auth/register', { name, email, password });
    set({ isLoading: false });
  },
}));
