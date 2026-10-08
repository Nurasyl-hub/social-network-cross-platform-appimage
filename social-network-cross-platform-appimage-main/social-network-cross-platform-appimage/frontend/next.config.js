
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: { domains: ['localhost'] },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://backend:8080'}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://backend:8080'}/uploads/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
