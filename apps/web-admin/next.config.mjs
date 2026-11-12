import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@crm-builder/shared'],

  // Otimizacoes para producao
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,

  // Remover console.log em producao (manter error e warn)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // Ignorar erros de ESLint e TypeScript no build de producao
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Permitir imagens de fontes externas se necessario
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // A administracao da empresa mudou para /{empresa}/gestao/...: links e favoritos
  // antigos continuam funcionando.
  async redirects() {
    return [
      {
        source: '/:locale(pt-BR|en|es)/:tenant/:section(users|roles|entities|pdf-templates|dashboard-templates|public-links|audit-logs|execution-logs|permissions)/:rest*',
        destination: '/:locale/:tenant/gestao/:section/:rest*',
        permanent: false,
      },
    ];
  },

  // Excluir canvas (dependencia nativa do Konva) do bundle server-side
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'canvas'];
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
