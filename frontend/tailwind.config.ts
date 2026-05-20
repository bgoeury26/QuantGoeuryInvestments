import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0b0d',
        surface: '#0f1117',
        'surface-2': '#141720',
        'surface-3': '#1a1f2e',
        border: '#1e2435',
        'border-bright': '#2a3148',
        text: '#e2e8f0',
        muted: '#64748b',
        faint: '#334155',
        primary: '#3b82f6',
        'primary-hover': '#2563eb',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        purple: '#8b5cf6',
        cyan: '#06b6d4',
        gold: '#eab308',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh': 'radial-gradient(ellipse at top, #1a1f2e 0%, #0a0b0d 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        'count-up': 'countUp 0.6s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        countUp: { '0%': { transform: 'translateY(4px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      boxShadow: {
        glow: '0 0 20px rgba(59,130,246,0.15)',
        'glow-success': '0 0 20px rgba(16,185,129,0.15)',
        'glow-danger': '0 0 20px rgba(239,68,68,0.15)',
        card: '0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2)',
      },
    },
  },
  plugins: [],
};

export default config;
