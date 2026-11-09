import { Dancing_Script } from 'next/font/google';

/**
 * Letra manuscrita das paginas para clientes (estilo scrapbook). Servida pelo
 * proprio site (next/font), igual em qualquer aparelho.
 */
export const siteScriptFont = Dancing_Script({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-site-script',
  display: 'swap',
});
