import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Buscando tenant Marisa Dilda...');
  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Marisa', mode: 'insensitive' } },
  });

  if (!tenant) {
    throw new Error('Tenant Marisa Dilda não encontrado');
  }
  console.log(`✅ Tenant encontrado: ${tenant.name} (${tenant.id})`);

  console.log('\n🔍 Buscando entity Sinistros...');
  const entity = await prisma.entity.findFirst({
    where: {
      tenantId: tenant.id,
      OR: [
        { name: { contains: 'Sinistro', mode: 'insensitive' } },
        { slug: { contains: 'sinistro', mode: 'insensitive' } },
      ],
    },
  });

  if (!entity) {
    throw new Error('Entity Sinistros não encontrada');
  }
  console.log(`✅ Entity encontrada: ${entity.name} (${entity.slug})`);

  console.log('\n🔍 Buscando dashboard source (iOS Risk - Dashboard Completo)...');
  const sourceDashboard = await prisma.dashboardTemplate.findFirst({
    where: {
      tenantId: tenant.id,
      name: { contains: 'iOS Risk - Dashboard Completo', mode: 'insensitive' },
    },
  });

  if (!sourceDashboard) {
    throw new Error('Dashboard source não encontrado');
  }
  console.log(`✅ Dashboard source: ${sourceDashboard.name}`);

  console.log('\n🔍 Buscando dashboard target (Sinistro - Tabela)...');
  let targetDashboard = await prisma.dashboardTemplate.findFirst({
    where: {
      tenantId: tenant.id,
      entitySlug: entity.slug,
      name: { contains: 'Sinistro - Tabela', mode: 'insensitive' },
    },
  });

  if (!targetDashboard) {
    console.log('⚠️  Dashboard target não encontrado, criando...');
    // Buscar uma role para associar o dashboard
    const role = await prisma.customRole.findFirst({
      where: { tenantId: tenant.id, roleType: 'ADMIN' },
    });

    if (!role) {
      throw new Error('Role ADMIN não encontrada para criar dashboard');
    }

    targetDashboard = await prisma.dashboardTemplate.create({
      data: {
        name: 'Sinistro - Tabela',
        description: 'Dashboard com tabela e análises de sinistros',
        tenantId: tenant.id,
        entitySlug: entity.slug,
        roleIds: [role.id],
        priority: 0,
        isActive: true,
        layout: [],
        widgets: {},
        tabs: [],
      },
    });
    console.log(`✅ Dashboard criado: ${targetDashboard.name}`);
  } else {
    console.log(`✅ Dashboard target: ${targetDashboard.name}`);
  }

  console.log('\n📋 Copiando widgets do dashboard source...');
  const sourceLayout = sourceDashboard.layout as any;
  const targetLayout = targetDashboard.layout as any;

  if (!sourceLayout || !sourceLayout.tabs || sourceLayout.tabs.length === 0) {
    console.log('⚠️  Dashboard source não tem tabs/widgets para copiar');
    return;
  }

  // Copiar todas as tabs do source para o target, mantendo as tabs existentes
  const existingTabs = targetLayout.tabs || [];
  const newTabs = sourceLayout.tabs.map((tab: any) => ({
    ...tab,
    id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  }));

  const updatedLayout = {
    tabs: [...existingTabs, ...newTabs],
  };

  await prisma.dashboardTemplate.update({
    where: { id: targetDashboard.id },
    data: { layout: updatedLayout },
  });

  console.log(`✅ ${newTabs.length} tabs copiadas com sucesso!`);
  console.log(`   Total de tabs no dashboard: ${updatedLayout.tabs.length}`);

  console.log('\n✅ Operação concluída!');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
