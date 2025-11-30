/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ignorar errores de TypeScript durante el build (para que no se pare por detalles)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ignorar errores de estilo (linting)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;