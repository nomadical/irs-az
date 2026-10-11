import type { NextConfig } from 'next';
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Self-contained server for the Docker image (see apps/web/Dockerfile)
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Share-image fonts and page copy are read from disk at runtime
  outputFileTracingIncludes: { '/**': ['./assets/fonts/**', './content/**'] },
  transpilePackages: ['@irs-az/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
