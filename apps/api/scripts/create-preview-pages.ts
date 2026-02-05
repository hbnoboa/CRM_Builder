import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Templates de páginas para cada entidade
function createListPage(entityName: string, entitySlug: string) {
  return {
    slug: `${entitySlug}-lista`,
    title: `Lista de ${entityName}`,
    description: `Página de listagem de ${entityName}`,
    icon: 'List',
    content: {
      root: {
        props: {
          title: `Lista de ${entityName}`,
        },
      },
      content: [
        {
          type: 'Hero',
          props: {
            title: `Lista de ${entityName}`,
            subtitle: `Gerencie todos os registros de ${entityName}`,
          },
        },
        {
          type: 'EntityList',
          props: {
            entitySlug: entitySlug,
          },
        },
      ],
      zones: {},
    },
    isPublished: true,
  };
}

function createNewPage(entityName: string, entitySlug: string) {
  return {
    slug: `${entitySlug}-novo`,
    title: `Novo ${entityName}`,
    description: `Página de cadastro de ${entityName}`,
    icon: 'Plus',
    content: {
      root: {
        props: {
          title: `Novo ${entityName}`,
        },
      },
      content: [
        {
          type: 'Hero',
          props: {
            title: `Novo ${entityName}`,
            subtitle: `Cadastre um novo registro de ${entityName}`,
          },
        },
        {
          type: 'EntityDataForm',
          props: {
            entitySlug: entitySlug,
            mode: 'create',
            // HREF SEM locale e SEM /preview/ - a normalizeHref cuida disso
            redirectAfterSubmit: `/${entitySlug}-lista`,
          },
        },
      ],
      zones: {},
    },
    isPublished: true,
  };
}

function createEditPage(entityName: string, entitySlug: string) {
  return {
    slug: `${entitySlug}-editar`,
    title: `Editar ${entityName}`,
    description: `Página de edição de ${entityName}`,
    icon: 'Pencil',
    content: {
      root: {
        props: {
          title: `Editar ${entityName}`,
        },
      },
      content: [
        {
          type: 'Hero',
          props: {
            title: `Editar ${entityName}`,
            subtitle: `Edite o registro de ${entityName}`,
          },
        },
        {
          type: 'EntityDataForm',
          props: {
            entitySlug: entitySlug,
            mode: 'edit',
            // HREF SEM locale e SEM /preview/ - a normalizeHref cuida disso
            redirectAfterSubmit: `/${entitySlug}-lista`,
          },
        },
      ],
      zones: {},
    },
    isPublished: true,
  };
}

function createDashboardPage(tenantId: string) {
  return {
    slug: 'dashboard',
    title: 'Dashboard',
    description: 'Página inicial do sistema',
    icon: 'LayoutDashboard',
    content: {
      root: {
        props: {
          title: 'Dashboard',
        },
      },
      content: [
        {
          type: 'Hero',
          props: {
            title: 'Bem-vindo ao Sistema',
            subtitle: 'Selecione uma opção abaixo',
          },
        },
        {
          type: 'DashboardCards',
          props: {
            cards: [
              {
                title: 'Sinistros',
                description: 'Gerenciar sinistros',
                icon: 'FileWarning',
                // HREF SEM locale - começa com / mas não tem /preview/
                href: '/sinistro-lista',
              },
              {
                title: 'Clientes',
                description: 'Gerenciar clientes',
                icon: 'Users',
                href: '/cliente-lista',
              },
            ],
          },
        },
      ],
      zones: {},
    },
    isPublished: true,
    tenantId,
  };
}

async function main() {
  console.log('🔍 Buscando entidades...\n');
  
  const entities = await prisma.entity.findMany({
    select: { name: true, slug: true, tenantId: true }
  });

  // Agrupar entidades por tenant
  const entitiesByTenant: Record<string, Array<{name: string, slug: string}>> = {};
  
  for (const entity of entities) {
    if (!entitiesByTenant[entity.tenantId]) {
      entitiesByTenant[entity.tenantId] = [];
    }
    entitiesByTenant[entity.tenantId].push({
      name: entity.name,
      slug: entity.slug,
    });
  }

  let totalCreated = 0;

  for (const [tenantId, tenantEntities] of Object.entries(entitiesByTenant)) {
    console.log(`\n📁 Tenant: ${tenantId}`);
    console.log(`   Entidades: ${tenantEntities.length}`);
    
    // Criar páginas para cada entidade
    for (const entity of tenantEntities) {
      const pages = [
        createListPage(entity.name, entity.slug),
        createNewPage(entity.name, entity.slug),
        createEditPage(entity.name, entity.slug),
      ];
      
      for (const page of pages) {
        try {
          // Verificar se já existe
          const existing = await prisma.page.findFirst({
            where: {
              tenantId,
              slug: page.slug,
            },
          });
          
          if (existing) {
            console.log(`   ⏭️  ${page.slug} (já existe)`);
            continue;
          }
          
          await prisma.page.create({
            data: {
              ...page,
              tenantId,
              content: page.content as any,
            },
          });
          
          console.log(`   ✅ ${page.slug}`);
          totalCreated++;
        } catch (error: any) {
          console.log(`   ❌ ${page.slug}: ${error.message}`);
        }
      }
    }
    
    // Criar dashboard se não existir
    const dashboardExists = await prisma.page.findFirst({
      where: { tenantId, slug: 'dashboard' },
    });
    
    if (!dashboardExists) {
      const dashboard = createDashboardPage(tenantId);
      await prisma.page.create({
        data: {
          slug: dashboard.slug,
          title: dashboard.title,
          description: dashboard.description,
          icon: dashboard.icon,
          content: dashboard.content as any,
          isPublished: dashboard.isPublished,
          tenantId,
        },
      });
      console.log(`   ✅ dashboard`);
      totalCreated++;
    }
  }

  console.log(`\n✨ Total de páginas criadas: ${totalCreated}`);
  
  // Verificar hrefs criados
  console.log('\n🔍 Verificando hrefs nas páginas criadas...\n');
  
  const allPages = await prisma.page.findMany({
    select: { slug: true, content: true, tenantId: true },
    take: 10, // Amostra
  });
  
  for (const page of allPages) {
    const contentStr = JSON.stringify(page.content);
    
    // Verificar se tem locale no href
    if (contentStr.includes('/pt-BR/') || contentStr.includes('/en/') || contentStr.includes('/es/')) {
      console.log(`❌ PROBLEMA: ${page.slug} contém locale no href!`);
    }
    
    // Verificar hrefs
    const hrefMatches = contentStr.match(/"href":"([^"]+)"/g);
    if (hrefMatches) {
      console.log(`📄 ${page.slug}:`);
      for (const match of hrefMatches) {
        const href = match.replace(/"href":"/, '').replace(/"$/, '');
        console.log(`   href: ${href}`);
      }
    }
    
    // Verificar redirectAfterSubmit
    const redirectMatches = contentStr.match(/"redirectAfterSubmit":"([^"]+)"/g);
    if (redirectMatches) {
      for (const match of redirectMatches) {
        const redirect = match.replace(/"redirectAfterSubmit":"/, '').replace(/"$/, '');
        console.log(`   redirectAfterSubmit: ${redirect}`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
