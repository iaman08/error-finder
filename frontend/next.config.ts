import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(import.meta.dirname),
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', '@radix-ui/react-tooltip'],
  },
};

export default nextConfig;
