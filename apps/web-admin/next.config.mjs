/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  
  // Otimizações para produção
  poweredByHeader: false,
  reactStrictMode: true,
  
  // Ignorar erros de ESLint e TypeScript no build de produção
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Permitir imagens de fontes externas se necessário
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
