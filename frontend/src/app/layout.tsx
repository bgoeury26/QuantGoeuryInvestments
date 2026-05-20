import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'QuantGoeuryInvestments — AI Financial Intelligence',
  description: 'Hedge fund-grade AI research terminal: scoring engine, alpha signals, opportunity ranker, institutional flows.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-bg text-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
