import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Enable server components optimizations
  },
};

export default nextConfig;
