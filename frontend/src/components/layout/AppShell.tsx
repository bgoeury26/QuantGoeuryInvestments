'use client';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';

export default function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const { fetchMe, user, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    fetchMe().then(() => {
      const u = useAuthStore.getState().user;
      if (u && u.status !== 'APPROVED') router.push('/pending');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex-1 ml-56 flex flex-col min-h-screen">
        <TopBar title={title} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
