import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Locales conhecidos para limpeza de hrefs
const KNOWN_LOCALES = ['pt-BR', 'en', 'es'];

/**
 * Remove prefixo de locale de um href se presente.
 * Ex: "/pt-BR/preview/page" -> "/preview/page"
 * Ex: "pt-BR/preview/page" -> "preview/page"
 */
function stripLocaleFromHref(href: string): string {
  if (!href || typeof href !== 'string') return href;

  for (const locale of KNOWN_LOCALES) {
    // Com barra no inicio: /pt-BR/preview -> /preview
    if (href.startsWith(`/${locale}/`)) {
      return href.slice(locale.length + 1);
    }
    // Sem barra no inicio: pt-BR/preview -> preview
    if (href.startsWith(`${locale}/`)) {
      return href.slice(locale.length + 1);
    }
    // Apenas o locale: /pt-BR -> /
    if (href === `/${locale}`) {
      return '/';
    }
  }
  return href;
}

/**
 * Percorre recursivamente o conteudo do Puck e limpa os hrefs
 * removendo prefixos de locale para evitar duplicacao.
 */
function cleanPuckContent(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => cleanPuckContent(item));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Se for um campo href, limpar o locale
      if (key === 'href' && typeof value === 'string') {
        result[key] = stripLocaleFromHref(value);
      } else {
        result[key] = cleanPuckContent(value);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Verifica se o conteudo tem algum href com locale
 */
function hasLocaleInHrefs(obj: unknown): boolean {
  if (obj === null || obj === undefined) return false;

  if (Array.isArray(obj)) {
    return obj.some(item => hasLocaleInHrefs(item));
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key === 'href' && typeof value === 'string') {
        for (const locale of KNOWN_LOCALES) {
          if (value.startsWith(`/${locale}/`) || value.startsWith(`${locale}/`) || value === `/${locale}`) {
            return true;
          }
        }
      } else if (hasLocaleInHrefs(value)) {
        return true;
      }
    }
  }

  return false;
}

async function main() {
  console.log('Buscando todas as paginas...');

  const pages = await prisma.page.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      tenantId: true,
    },
  });

  console.log(`Encontradas ${pages.length} paginas`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const page of pages) {
    if (!page.content || !hasLocaleInHrefs(page.content)) {
      skippedCount++;
      continue;
    }

    console.log(`\nLimpando pagina: "${page.title}" (${page.slug})`);
    console.log(`  Conteudo antes:`, JSON.stringify(page.content).substring(0, 200) + '...');

    const cleanedContent = cleanPuckContent(page.content);

    console.log(`  Conteudo depois:`, JSON.stringify(cleanedContent).substring(0, 200) + '...');

    await prisma.page.update({
      where: { id: page.id },
      data: {
        content: cleanedContent as Prisma.JsonObject,
      },
    });

    updatedCount++;
    console.log(`  Pagina atualizada!`);
  }

  console.log('\n========================================');
  console.log(`Paginas atualizadas: ${updatedCount}`);
  console.log(`Paginas sem alteracao: ${skippedCount}`);
  console.log('========================================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
