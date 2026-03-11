import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/pillars',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
