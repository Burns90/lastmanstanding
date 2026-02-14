/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use SSR instead of static export for dynamic routes
  // This allows user-specific pages (leagues, rounds) to work properly
  reactStrictMode: true,
};

export default nextConfig;
