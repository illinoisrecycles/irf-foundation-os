/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  /**
   * ⚠️  WARNING: TypeScript errors are currently ignored during builds.
   * 
   * This should be set to false in production to catch bugs early.
   * Run `npm run build` locally with ignoreBuildErrors: false to see all issues.
   * 
   * TODO: Fix all TypeScript errors and remove this flag before production launch.
   */
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV !== 'production' || process.env.SKIP_TYPE_CHECK === 'true',
  },
  
  /**
   * ⚠️  WARNING: ESLint errors are currently ignored during builds.
   * 
   * Run `npm run lint` locally to see all linting issues.
   * 
   * TODO: Fix all ESLint errors and remove this flag before production launch.
   */
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV !== 'production' || process.env.SKIP_LINT === 'true',
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
