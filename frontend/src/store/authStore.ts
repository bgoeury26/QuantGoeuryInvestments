'use client';
import { create } from 'zustand';
import Cookies from 'js-cookie';
import { authApi, User } from '@/lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login:  (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authApi.login(email, password);
      Cookies.set('access_token', data.access_token, { expires: 7, sameSite: 'strict' });
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Login failed';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  signup: async (email, password, name) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.signup(email, password, name);
      set({ isLoading: false });
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Signup failed';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  logout: () => {
    Cookies.remove('access_token');
    set({ user: null, isAuthenticated: false });
    if (typeof window !== 'undefined') window.location.href = '/login';
  },

  fetchMe: async () => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.me();
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      Cookies.remove('access_token');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
