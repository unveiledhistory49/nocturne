/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { optimizePackageImports: ['@visx/shape', '@visx/scale'] }
};
export default nextConfig;
