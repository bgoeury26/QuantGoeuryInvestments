'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAuthStore } from '../../store/auth.store';

export default function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
      return;
    }
    if (!isLoading && user && user.status === 'PENDING') {
      router.push('/pending');
      return;
    }
    if (!isLoading && user && user.status !== 'APPROVED') {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={title} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
