import { PrismaClient, UserRole, Status, Plan } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // 1. Criar Platform Admin (Super Admin)
  const platformAdminPassword = await bcrypt.hash('superadmin123', 12);
  
  // Primeiro, criar um tenant para o platform admin (necessário pela FK)
  const platformTenant = await prisma.tenant.upsert({
    where: { slug: 'platform' },
    update: {},
    create: {
      name: 'Platform',
      slug: 'platform',
      plan: Plan.ENTERPRISE,
      status: Status.ACTIVE,
    },
  });

  const platformOrg = await prisma.organization.upsert({
    where: {
      tenantId_slug: {
        tenantId: platformTenant.id,
        slug: 'platform-admin',
      },
    },
    update: {},
    create: {
      tenantId: platformTenant.id,
      name: 'Platform Admin',
      slug: 'platform-admin',
    },
  });

  const platformAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: platformTenant.id,
        email: 'superadmin@platform.com',
      },
    },
    update: {},
    create: {
      tenantId: platformTenant.id,
      organizationId: platformOrg.id,
      email: 'superadmin@platform.com',
      password: platformAdminPassword,
      name: 'Super Admin',
      role: UserRole.PLATFORM_ADMIN,
      status: Status.ACTIVE,
    },
  });

  console.log('✅ Platform Admin criado:', platformAdmin.email);

  // 2. Criar Tenant de Demo
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Empresa Demo',
      slug: 'demo',
      plan: Plan.PROFESSIONAL,
      status: Status.ACTIVE,
      settings: {
        theme: 'light',
        language: 'pt-BR',
      },
    },
  });

  console.log('✅ Tenant demo criado:', demoTenant.slug);

  // 3. Criar Organizações do Demo
  const orgSP = await prisma.organization.upsert({
    where: {
      tenantId_slug: {
        tenantId: demoTenant.id,
        slug: 'filial-sp',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: 'Filial São Paulo',
      slug: 'filial-sp',
    },
  });

  const orgRJ = await prisma.organization.upsert({
    where: {
      tenantId_slug: {
        tenantId: demoTenant.id,
        slug: 'filial-rj',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: 'Filial Rio de Janeiro',
      slug: 'filial-rj',
    },
  });

  console.log('✅ Organizações criadas');

  // 4. Criar Workspace
  const workspace = await prisma.workspace.upsert({
    where: {
      organizationId_slug: {
        organizationId: orgSP.id,
        slug: 'crm-vendas',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      organizationId: orgSP.id,
      name: 'CRM de Vendas',
      slug: 'crm-vendas',
      description: 'CRM para gestão de vendas',
    },
  });

  console.log('✅ Workspace criado:', workspace.slug);

  // 5. Criar Usuários de Demo
  const adminPassword = await bcrypt.hash('admin123', 12);
  const userPassword = await bcrypt.hash('user123', 12);

  const admin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: demoTenant.id,
        email: 'admin@demo.com',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      organizationId: orgSP.id,
      email: 'admin@demo.com',
      password: adminPassword,
      name: 'Admin Demo',
      role: UserRole.ADMIN,
      status: Status.ACTIVE,
    },
  });

  const gerente = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: demoTenant.id,
        email: 'gerente@demo.com',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      organizationId: orgSP.id,
      email: 'gerente@demo.com',
      password: userPassword,
      name: 'Gerente Demo',
      role: UserRole.MANAGER,
      status: Status.ACTIVE,
    },
  });

  const vendedor = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: demoTenant.id,
        email: 'vendedor@demo.com',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      organizationId: orgSP.id,
      email: 'vendedor@demo.com',
      password: userPassword,
      name: 'Vendedor Demo',
      role: UserRole.USER,
      status: Status.ACTIVE,
    },
  });

  const viewer = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: demoTenant.id,
        email: 'viewer@demo.com',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      organizationId: orgSP.id,
      email: 'viewer@demo.com',
      password: userPassword,
      name: 'Visualizador Demo',
      role: UserRole.VIEWER,
      status: Status.ACTIVE,
    },
  });

  console.log('✅ Usuários criados:');
  console.log('   - admin@demo.com / admin123');
  console.log('   - gerente@demo.com / user123');
  console.log('   - vendedor@demo.com / user123');
  console.log('   - viewer@demo.com / user123');

  // 6. Criar Entidade "Cliente"
  const clienteEntity = await prisma.entity.upsert({
    where: {
      workspaceId_slug: {
        workspaceId: workspace.id,
        slug: 'cliente',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      workspaceId: workspace.id,
      name: 'Cliente',
      namePlural: 'Clientes',
      slug: 'cliente',
      description: 'Cadastro de clientes',
      icon: 'users',
      color: '#3B82F6',
      fields: [
        {
          slug: 'nome',
          name: 'Nome',
          type: 'text',
          required: true,
        },
        {
          slug: 'email',
          name: 'Email',
          type: 'email',
          required: true,
        },
        {
          slug: 'telefone',
          name: 'Telefone',
          type: 'phone',
          required: false,
        },
        {
          slug: 'empresa',
          name: 'Empresa',
          type: 'text',
          required: false,
        },
        {
          slug: 'status',
          name: 'Status',
          type: 'select',
          required: true,
          default: 'prospecto',
          options: [
            { value: 'prospecto', label: 'Prospecto', color: '#F59E0B' },
            { value: 'ativo', label: 'Ativo', color: '#22C55E' },
            { value: 'inativo', label: 'Inativo', color: '#EF4444' },
          ],
        },
        {
          slug: 'valor_contrato',
          name: 'Valor do Contrato',
          type: 'currency',
          required: false,
        },
        {
          slug: 'observacoes',
          name: 'Observações',
          type: 'textarea',
          required: false,
        },
      ],
      settings: {
        titleField: 'nome',
        subtitleField: 'empresa',
        searchFields: ['nome', 'email', 'empresa'],
        defaultSort: { field: 'createdAt', order: 'desc' },
      },
    },
  });

  console.log('✅ Entidade "Cliente" criada');

  // 7. Criar alguns clientes de exemplo
  const clientes = [
    {
      nome: 'João Silva',
      email: 'joao@empresa.com',
      telefone: '11999999999',
      empresa: 'Tech Solutions',
      status: 'ativo',
      valor_contrato: 5000,
    },
    {
      nome: 'Maria Santos',
      email: 'maria@startup.com',
      telefone: '11988888888',
      empresa: 'Startup XYZ',
      status: 'prospecto',
      valor_contrato: 0,
    },
    {
      nome: 'Carlos Oliveira',
      email: 'carlos@comercio.com',
      telefone: '11977777777',
      empresa: 'Comércio ABC',
      status: 'ativo',
      valor_contrato: 3500,
    },
  ];

  for (const cliente of clientes) {
    await prisma.entityData.create({
      data: {
        tenantId: demoTenant.id,
        entityId: clienteEntity.id,
        data: cliente,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }

  console.log('✅ Clientes de exemplo criados');

  // 8. Criar Roles personalizadas
  const vendedorSeniorRole = await prisma.role.upsert({
    where: {
      tenantId_slug: {
        tenantId: demoTenant.id,
        slug: 'vendedor-senior',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: 'Vendedor Sênior',
      slug: 'vendedor-senior',
      description: 'Pode editar clientes da equipe',
      permissions: [
        'data:read:all',
        'data:create:own',
        'data:update:team',
        'cliente:update:team',
      ],
    },
  });

  const financeiroRole = await prisma.role.upsert({
    where: {
      tenantId_slug: {
        tenantId: demoTenant.id,
        slug: 'financeiro',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: 'Financeiro',
      slug: 'financeiro',
      description: 'Acesso a dados financeiros',
      permissions: [
        'data:read:all',
        'pagamento:manage:all',
        'cliente:read:all',
      ],
    },
  });

  console.log('✅ Roles personalizadas criadas');

  console.log('\n═══════════════════════════════════════════════════');
  console.log('🎉 SEED COMPLETO!');
  console.log('═══════════════════════════════════════════════════');
  console.log('\n📝 Credenciais de teste:');
  console.log('');
  console.log('SUPER ADMIN:');
  console.log('   Email: superadmin@platform.com');
  console.log('   Senha: superadmin123');
  console.log('');
  console.log('ADMIN (Tenant Demo):');
  console.log('   Email: admin@demo.com');
  console.log('   Senha: admin123');
  console.log('');
  console.log('OUTROS USUÁRIOS (Senha: user123):');
  console.log('   - gerente@demo.com (Manager)');
  console.log('   - vendedor@demo.com (User)');
  console.log('   - viewer@demo.com (Viewer)');
  console.log('');
  console.log('═══════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
