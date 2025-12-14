/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Build checks enabled - fix errors properly
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig
