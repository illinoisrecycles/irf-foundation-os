/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Ignore type errors until Supabase types are generated
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Allow external images
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google Auth
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' }, // GitHub Auth
      { protocol: 'https', hostname: '*.supabase.co' }, // Supabase Storage
      { protocol: 'https', hostname: '*.supabase.in' }, // Supabase Storage alt
      { protocol: 'https', hostname: 'images.unsplash.com' }, // Unsplash
      { protocol: 'https', hostname: 'ui-avatars.com' }, // Generated avatars
    ],
  },
  
  // Experimental features
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig
