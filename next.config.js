/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'render.openstreetmap.org',
        pathname: '/**',
      },

      // Domenii reale OLX pentru imagini
      {
        protocol: 'https',
        hostname: 'ireland.apollo.olxcdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'frankfurt.apollo.olxcdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'apollo-ireland.akamaized.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'apollo.olxcdn.com',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: [
      '@opentelemetry/instrumentation',
      'require-in-the-middle'
    ],
  },
};

module.exports = nextConfig;
