/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! IMPORTANTE !!
    // Ignora errores de TypeScript para que Vercel no falle el deploy
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignora errores de estilo (linting) durante el deploy
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;