import { PrismaClient, UserRole, Status, Plan } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================================================
// TENANT: MARISA DILDA (Form Generator)
// ============================================================================
async function seedMarisaDilda() {
  console.log('\n--- Criando Tenant: Marisa Dilda ---');

  // 1. Criar Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'marisa-dilda' },
    update: {},
    create: {
      name: 'Marisa Dilda',
      slug: 'marisa-dilda',
      plan: Plan.PROFESSIONAL,
      status: Status.ACTIVE,
      settings: {
        theme: 'light',
        language: 'pt-BR',
      },
    },
  });

  console.log('Tenant criado:', tenant.slug);

  // 2. Criar Usuarios
  const adminPassword = await bcrypt.hash('marisa123', 12);
  const userPassword = await bcrypt.hash('user123', 12);

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@marisadilda.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@marisadilda.com',
      password: adminPassword,
      name: 'Marisa Admin',
      role: UserRole.ADMIN,
      status: Status.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'operador@marisadilda.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'operador@marisadilda.com',
      password: userPassword,
      name: 'Operador Marisa',
      role: UserRole.USER,
      status: Status.ACTIVE,
    },
  });

  console.log('Usuarios criados');

  // 3. Entidade: Formularios (definicao de formularios dinamicos)
  const formEntity = await prisma.entity.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'formulario' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Formulario',
      namePlural: 'Formularios',
      slug: 'formulario',
      description: 'Definicao de formularios dinamicos',
      icon: 'file-text',
      color: '#8B5CF6',
      fields: [
        { slug: 'nome', name: 'Nome', type: 'text', required: true },
        { slug: 'descricao', name: 'Descricao', type: 'textarea', required: false },
        {
          slug: 'status',
          name: 'Status',
          type: 'select',
          required: true,
          default: 'ativo',
          options: [
            { value: 'ativo', label: 'Ativo', color: '#22C55E' },
            { value: 'rascunho', label: 'Rascunho', color: '#F59E0B' },
            { value: 'arquivado', label: 'Arquivado', color: '#6B7280' },
          ],
        },
        {
          slug: 'campos',
          name: 'Campos do Formulario',
          type: 'json',
          required: false,
        },
      ],
      settings: {
        titleField: 'nome',
        subtitleField: 'descricao',
        searchFields: ['nome', 'descricao'],
        defaultSort: { field: 'createdAt', order: 'desc' },
      },
    },
  });

  console.log('Entidade "Formulario" criada');

  // 4. Entidade: Registros (respostas dos formularios)
  const registroEntity = await prisma.entity.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'registro' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Registro',
      namePlural: 'Registros',
      slug: 'registro',
      description: 'Respostas preenchidas dos formularios',
      icon: 'clipboard-list',
      color: '#3B82F6',
      fields: [
        {
          slug: 'formulario_id',
          name: 'Formulario',
          type: 'relation',
          required: true,
          relation: {
            entity: 'formulario',
            displayField: 'nome',
          },
        },
        { slug: 'responsavel', name: 'Responsavel', type: 'text', required: true },
        {
          slug: 'status',
          name: 'Status',
          type: 'select',
          required: true,
          default: 'pendente',
          options: [
            { value: 'pendente', label: 'Pendente', color: '#F59E0B' },
            { value: 'em_andamento', label: 'Em Andamento', color: '#3B82F6' },
            { value: 'concluido', label: 'Concluido', color: '#22C55E' },
            { value: 'cancelado', label: 'Cancelado', color: '#EF4444' },
          ],
        },
        { slug: 'data_preenchimento', name: 'Data de Preenchimento', type: 'date', required: false },
        { slug: 'dados', name: 'Dados do Formulario', type: 'json', required: false },
        { slug: 'observacoes', name: 'Observacoes', type: 'textarea', required: false },
      ],
      settings: {
        titleField: 'responsavel',
        subtitleField: 'status',
        searchFields: ['responsavel', 'observacoes'],
        defaultSort: { field: 'createdAt', order: 'desc' },
      },
    },
  });

  console.log('Entidade "Registro" criada');

  // 5. Entidade: Subformularios
  const subformEntity = await prisma.entity.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'subformulario' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Subformulario',
      namePlural: 'Subformularios',
      slug: 'subformulario',
      description: 'Formularios filhos vinculados a um formulario pai',
      icon: 'layers',
      color: '#EC4899',
      fields: [
        {
          slug: 'formulario_pai_id',
          name: 'Formulario Pai',
          type: 'relation',
          required: true,
          relation: {
            entity: 'formulario',
            displayField: 'nome',
          },
        },
        { slug: 'nome', name: 'Nome', type: 'text', required: true },
        { slug: 'descricao', name: 'Descricao', type: 'textarea', required: false },
        { slug: 'campos', name: 'Campos', type: 'json', required: false },
      ],
      settings: {
        titleField: 'nome',
        subtitleField: 'descricao',
        searchFields: ['nome', 'descricao'],
        defaultSort: { field: 'createdAt', order: 'desc' },
      },
    },
  });

  console.log('Entidade "Subformulario" criada');

  // 6. Dados de exemplo
  const formularioChecklistVeicular = await prisma.entityData.create({
    data: {
      tenantId: tenant.id,
      entityId: formEntity.id,
      data: {
        nome: 'Checklist Veicular',
        descricao: 'Formulario para inspecao de veiculos',
        status: 'ativo',
        campos: [
          { name: 'placa', type: 'text', label: 'Placa', required: true },
          { name: 'km', type: 'number', label: 'Quilometragem', required: true },
          { name: 'combustivel', type: 'select', label: 'Nivel de Combustivel', options: ['Vazio', '1/4', '1/2', '3/4', 'Cheio'] },
          { name: 'pneus_ok', type: 'boolean', label: 'Pneus OK' },
          { name: 'farois_ok', type: 'boolean', label: 'Farois OK' },
          { name: 'foto_veiculo', type: 'image', label: 'Foto do Veiculo' },
          { name: 'observacoes', type: 'textarea', label: 'Observacoes' },
        ],
      },
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  const formularioOS = await prisma.entityData.create({
    data: {
      tenantId: tenant.id,
      entityId: formEntity.id,
      data: {
        nome: 'Ordem de Servico',
        descricao: 'Formulario para abertura de OS',
        status: 'ativo',
        campos: [
          { name: 'cliente', type: 'text', label: 'Cliente', required: true },
          { name: 'servico', type: 'select', label: 'Tipo de Servico', options: ['Manutencao', 'Instalacao', 'Reparo', 'Troca'] },
          { name: 'descricao', type: 'textarea', label: 'Descricao do Servico', required: true },
          { name: 'prioridade', type: 'select', label: 'Prioridade', options: ['Baixa', 'Media', 'Alta', 'Urgente'] },
          { name: 'data_agendamento', type: 'date', label: 'Data Agendada' },
          { name: 'valor_estimado', type: 'currency', label: 'Valor Estimado' },
        ],
      },
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  console.log('Formularios de exemplo criados');

  // Registros de exemplo
  await prisma.entityData.createMany({
    data: [
      {
        tenantId: tenant.id,
        entityId: registroEntity.id,
        data: {
          formulario_id: formularioChecklistVeicular.id,
          responsavel: 'Joao Silva',
          status: 'concluido',
          data_preenchimento: '2024-01-15',
          dados: {
            placa: 'ABC-1234',
            km: 45000,
            combustivel: '3/4',
            pneus_ok: true,
            farois_ok: true,
            observacoes: 'Veiculo em bom estado',
          },
        },
        createdById: admin.id,
        updatedById: admin.id,
      },
      {
        tenantId: tenant.id,
        entityId: registroEntity.id,
        data: {
          formulario_id: formularioOS.id,
          responsavel: 'Maria Santos',
          status: 'em_andamento',
          data_preenchimento: '2024-01-20',
          dados: {
            cliente: 'Empresa XYZ',
            servico: 'Manutencao',
            descricao: 'Troca de oleo e filtros',
            prioridade: 'Media',
            data_agendamento: '2024-01-25',
            valor_estimado: 350,
          },
        },
        createdById: admin.id,
        updatedById: admin.id,
      },
    ],
  });

  console.log('Registros de exemplo criados');

  return { tenant, admin };
}

// ============================================================================
// TENANT: IOS (Car Inspection)
// ============================================================================
async function seedIOS() {
  console.log('\n--- Criando Tenant: IOS ---');

  // 1. Criar Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'ios' },
    update: {},
    create: {
      name: 'IOS Inspecao Veicular',
      slug: 'ios',
      plan: Plan.ENTERPRISE,
      status: Status.ACTIVE,
      settings: {
        theme: 'light',
        language: 'pt-BR',
        carDiagramUrl: '/uploads/car-diagram.jpg',
      },
    },
  });

  console.log('Tenant criado:', tenant.slug);

  // 2. Criar Usuarios
  const adminPassword = await bcrypt.hash('ios123', 12);
  const inspectorPassword = await bcrypt.hash('inspetor123', 12);

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@ios.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@ios.com',
      password: adminPassword,
      name: 'Admin IOS',
      role: UserRole.ADMIN,
      status: Status.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'inspetor@ios.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'inspetor@ios.com',
      password: inspectorPassword,
      name: 'Inspetor Carlos',
      role: UserRole.USER,
      status: Status.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'gerente@ios.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'gerente@ios.com',
      password: inspectorPassword,
      name: 'Gerente Pedro',
      role: UserRole.MANAGER,
      status: Status.ACTIVE,
    },
  });

  console.log('Usuarios criados');

  // 3. Entidade: Pecas do Veiculo (tabela de apoio)
  const pecaEntity = await prisma.entity.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'peca-veiculo' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Peca do Veiculo',
      namePlural: 'Pecas do Veiculo',
      slug: 'peca-veiculo',
      description: 'Catalogo de pecas/partes do veiculo para inspecao',
      icon: 'wrench',
      color: '#6366F1',
      fields: [
        { slug: 'nome', name: 'Nome', type: 'text', required: true },
        { slug: 'codigo', name: 'Codigo', type: 'text', required: false },
        {
          slug: 'categoria',
          name: 'Categoria',
          type: 'select',
          required: true,
          options: [
            { value: 'carroceria', label: 'Carroceria' },
            { value: 'vidros', label: 'Vidros' },
            { value: 'rodas', label: 'Rodas/Pneus' },
            { value: 'iluminacao', label: 'Iluminacao' },
            { value: 'interior', label: 'Interior' },
            { value: 'motor', label: 'Motor' },
          ],
        },
      ],
      settings: {
        titleField: 'nome',
        subtitleField: 'categoria',
        searchFields: ['nome', 'codigo'],
      },
      isSystem: true,
    },
  });

  // 4. Entidade: Tipos de Nao Conformidade
  const tipoNCEntity = await prisma.entity.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'tipo-nao-conformidade' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Tipo de Nao Conformidade',
      namePlural: 'Tipos de Nao Conformidade',
      slug: 'tipo-nao-conformidade',
      description: 'Tipos de problemas encontrados na inspecao',
      icon: 'alert-triangle',
      color: '#F59E0B',
      fields: [
        { slug: 'nome', name: 'Nome', type: 'text', required: true },
        { slug: 'descricao', name: 'Descricao', type: 'textarea', required: false },
        { slug: 'codigo', name: 'Codigo', type: 'text', required: false },
      ],
      settings: {
        titleField: 'nome',
        searchFields: ['nome', 'codigo'],
      },
      isSystem: true,
    },
  });

  // 5. Entidade: Niveis de Nao Conformidade
  const nivelNCEntity = await prisma.entity.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'nivel-nao-conformidade' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Nivel de Nao Conformidade',
      namePlural: 'Niveis de Nao Conformidade',
      slug: 'nivel-nao-conformidade',
      description: 'Gravidade dos problemas encontrados',
      icon: 'gauge',
      color: '#EF4444',
      fields: [
        { slug: 'nome', name: 'Nome', type: 'text', required: true },
        { slug: 'peso', name: 'Peso', type: 'number', required: true },
        { slug: 'cor', name: 'Cor', type: 'color', required: false },
      ],
      settings: {
        titleField: 'nome',
        subtitleField: 'peso',
        searchFields: ['nome'],
      },
      isSystem: true,
    },
  });

  // 6. Entidade: Quadrantes (zonas do veiculo)
  const quadranteEntity = await prisma.entity.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'quadrante' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Quadrante',
      namePlural: 'Quadrantes',
      slug: 'quadrante',
      description: 'Zonas do veiculo para marcacao de danos (diagrama)',
      icon: 'grid-3x3',
      color: '#8B5CF6',
      fields: [
        { slug: 'nome', name: 'Nome', type: 'text', required: true },
        { slug: 'codigo', name: 'Codigo', type: 'text', required: true },
        {
          slug: 'posicao',
          name: 'Posicao',
          type: 'select',
          required: true,
          options: [
            { value: 'frente', label: 'Frente' },
            { value: 'traseira', label: 'Traseira' },
            { value: 'lateral_esquerda', label: 'Lateral Esquerda' },
            { value: 'lateral_direita', label: 'Lateral Direita' },
            { value: 'teto', label: 'Teto' },
          ],
        },
        { slug: 'coord_x', name: 'Coordenada X (%)', type: 'number', required: false },
        { slug: 'coord_y', name: 'Coordenada Y (%)', type: 'number', required: false },
      ],
      settings: {
        titleField: 'nome',
        subtitleField: 'posicao',
        searchFields: ['nome', 'codigo'],
      },
      isSystem: true,
    },
  });

  // 7. Entidade: Veiculos
  const veiculoEntity = await prisma.entity.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'veiculo' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Veiculo',
      namePlural: 'Veiculos',
      slug: 'veiculo',
      description: 'Veiculos para inspecao',
      icon: 'car',
      color: '#3B82F6',
      fields: [
        { slug: 'chassi', name: 'Chassi', type: 'text', required: true },
        { slug: 'placa', name: 'Placa', type: 'text', required: false },
        { slug: 'marca', name: 'Marca', type: 'text', required: false },
        { slug: 'modelo', name: 'Modelo', type: 'text', required: false },
        { slug: 'ano', name: 'Ano', type: 'number', required: false },
        { slug: 'cor', name: 'Cor', type: 'text', required: false },
        {
          slug: 'tipo',
          name: 'Tipo',
          type: 'select',
          required: false,
          options: [
            { value: 'hatch', label: 'Hatch' },
            { value: 'sedan', label: 'Sedan' },
            { value: 'suv', label: 'SUV' },
            { value: 'pickup', label: 'Pickup' },
            { value: 'van', label: 'Van' },
            { value: 'caminhao', label: 'Caminhao' },
          ],
        },
        { slug: 'localizacao', name: 'Localizacao', type: 'text', required: false },
        { slug: 'navio', name: 'Navio/Viagem', type: 'text', required: false },
        {
          slug: 'status',
          name: 'Status',
          type: 'select',
          required: true,
          default: 'aguardando_inspecao',
          options: [
            { value: 'aguardando_inspecao', label: 'Aguardando Inspecao', color: '#F59E0B' },
            { value: 'em_inspecao', label: 'Em Inspecao', color: '#3B82F6' },
            { value: 'aprovado', label: 'Aprovado', color: '#22C55E' },
            { value: 'reprovado', label: 'Reprovado', color: '#EF4444' },
            { value: 'em_reparo', label: 'Em Reparo', color: '#8B5CF6' },
          ],
        },
        {
          slug: 'situacao',
          name: 'Situacao',
          type: 'select',
          required: false,
          options: [
            { value: 'novo', label: 'Novo' },
            { value: 'usado', label: 'Usado' },
            { value: 'sinistrado', label: 'Sinistrado' },
          ],
        },
        { slug: 'qtd_nao_conformidades', name: 'Qtd Nao Conformidades', type: 'number', required: false, default: 0 },
        { slug: 'foto_chassi', name: 'Foto do Chassi', type: 'image', required: false },
        { slug: 'foto_perfil', name: 'Foto de Perfil', type: 'image', required: false },
        { slug: 'observacoes', name: 'Observacoes', type: 'textarea', required: false },
      ],
      settings: {
        titleField: 'chassi',
        subtitleField: 'modelo',
        searchFields: ['chassi', 'placa', 'marca', 'modelo'],
        defaultSort: { field: 'createdAt', order: 'desc' },
      },
    },
  });

  console.log('Entidade "Veiculo" criada');

  // 8. Entidade: Nao Conformidades (sub-entidade de Veiculo)
  const ncEntity = await prisma.entity.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'nao-conformidade' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Nao Conformidade',
      namePlural: 'Nao Conformidades',
      slug: 'nao-conformidade',
      description: 'Problemas/danos encontrados no veiculo',
      icon: 'alert-circle',
      color: '#EF4444',
      fields: [
        {
          slug: 'veiculo_id',
          name: 'Veiculo',
          type: 'relation',
          required: true,
          relation: {
            entity: 'veiculo',
            displayField: 'chassi',
          },
        },
        {
          slug: 'peca_id',
          name: 'Peca Afetada',
          type: 'api-select',
          required: true,
          apiEndpoint: '/peca-veiculo',
          valueField: 'id',
          labelField: 'nome',
        },
        {
          slug: 'tipo_id',
          name: 'Tipo de NC',
          type: 'api-select',
          required: true,
          apiEndpoint: '/tipo-nao-conformidade',
          valueField: 'id',
          labelField: 'nome',
        },
        {
          slug: 'nivel_id',
          name: 'Nivel de Gravidade',
          type: 'api-select',
          required: true,
          apiEndpoint: '/nivel-nao-conformidade',
          valueField: 'id',
          labelField: 'nome',
        },
        {
          slug: 'quadrante_id',
          name: 'Quadrante/Zona',
          type: 'api-select',
          required: false,
          apiEndpoint: '/quadrante',
          valueField: 'id',
          labelField: 'nome',
        },
        { slug: 'medida', name: 'Medida (cm)', type: 'number', required: false },
        { slug: 'local_especifico', name: 'Local Especifico', type: 'text', required: false },
        { slug: 'foto_1', name: 'Foto 1', type: 'image', required: false },
        { slug: 'foto_2', name: 'Foto 2', type: 'image', required: false },
        { slug: 'foto_3', name: 'Foto 3', type: 'image', required: false },
        { slug: 'foto_4', name: 'Foto 4', type: 'image', required: false },
        { slug: 'observacoes', name: 'Observacoes', type: 'textarea', required: false },
      ],
      settings: {
        titleField: 'tipo_id',
        subtitleField: 'nivel_id',
        searchFields: ['local_especifico', 'observacoes'],
        defaultSort: { field: 'createdAt', order: 'desc' },
      },
    },
  });

  console.log('Entidade "Nao Conformidade" criada');

  // 9. Popular tabelas de apoio
  // Pecas do Veiculo
  const pecas = [
    { nome: 'Para-choque Dianteiro', codigo: 'PCD', categoria: 'carroceria' },
    { nome: 'Para-choque Traseiro', codigo: 'PCT', categoria: 'carroceria' },
    { nome: 'Capo', codigo: 'CAP', categoria: 'carroceria' },
    { nome: 'Tampa do Porta-malas', codigo: 'TPM', categoria: 'carroceria' },
    { nome: 'Porta Dianteira Esquerda', codigo: 'PDE', categoria: 'carroceria' },
    { nome: 'Porta Dianteira Direita', codigo: 'PDD', categoria: 'carroceria' },
    { nome: 'Porta Traseira Esquerda', codigo: 'PTE', categoria: 'carroceria' },
    { nome: 'Porta Traseira Direita', codigo: 'PTD', categoria: 'carroceria' },
    { nome: 'Paralama Dianteiro Esquerdo', codigo: 'PLDE', categoria: 'carroceria' },
    { nome: 'Paralama Dianteiro Direito', codigo: 'PLDD', categoria: 'carroceria' },
    { nome: 'Teto', codigo: 'TET', categoria: 'carroceria' },
    { nome: 'Para-brisa', codigo: 'PB', categoria: 'vidros' },
    { nome: 'Vidro Traseiro', codigo: 'VT', categoria: 'vidros' },
    { nome: 'Vidro Porta Diant. Esq.', codigo: 'VPDE', categoria: 'vidros' },
    { nome: 'Vidro Porta Diant. Dir.', codigo: 'VPDD', categoria: 'vidros' },
    { nome: 'Roda Dianteira Esquerda', codigo: 'RDE', categoria: 'rodas' },
    { nome: 'Roda Dianteira Direita', codigo: 'RDD', categoria: 'rodas' },
    { nome: 'Roda Traseira Esquerda', codigo: 'RTE', categoria: 'rodas' },
    { nome: 'Roda Traseira Direita', codigo: 'RTD', categoria: 'rodas' },
    { nome: 'Farol Esquerdo', codigo: 'FE', categoria: 'iluminacao' },
    { nome: 'Farol Direito', codigo: 'FD', categoria: 'iluminacao' },
    { nome: 'Lanterna Esquerda', codigo: 'LE', categoria: 'iluminacao' },
    { nome: 'Lanterna Direita', codigo: 'LD', categoria: 'iluminacao' },
    { nome: 'Painel', codigo: 'PNL', categoria: 'interior' },
    { nome: 'Banco Dianteiro', codigo: 'BD', categoria: 'interior' },
    { nome: 'Banco Traseiro', codigo: 'BT', categoria: 'interior' },
  ];

  for (const peca of pecas) {
    await prisma.entityData.create({
      data: {
        tenantId: tenant.id,
        entityId: pecaEntity.id,
        data: peca,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }
  console.log('Pecas do Veiculo cadastradas');

  // Tipos de NC
  const tiposNC = [
    { nome: 'Amassado', descricao: 'Deformacao na superficie', codigo: 'AMS' },
    { nome: 'Risco', descricao: 'Risco na pintura ou superficie', codigo: 'RSC' },
    { nome: 'Trinca', descricao: 'Rachadura no material', codigo: 'TRC' },
    { nome: 'Quebrado', descricao: 'Peca quebrada ou danificada', codigo: 'QBR' },
    { nome: 'Faltante', descricao: 'Peca ou componente faltando', codigo: 'FLT' },
    { nome: 'Desalinhado', descricao: 'Peca fora de alinhamento', codigo: 'DSL' },
    { nome: 'Oxidado', descricao: 'Ferrugem ou oxidacao', codigo: 'OXD' },
    { nome: 'Manchado', descricao: 'Mancha na superficie', codigo: 'MCH' },
    { nome: 'Descascado', descricao: 'Pintura descascando', codigo: 'DSC' },
  ];

  for (const tipo of tiposNC) {
    await prisma.entityData.create({
      data: {
        tenantId: tenant.id,
        entityId: tipoNCEntity.id,
        data: tipo,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }
  console.log('Tipos de NC cadastrados');

  // Niveis de NC
  const niveisNC = [
    { nome: 'Leve', peso: 1, cor: '#22C55E' },
    { nome: 'Moderado', peso: 2, cor: '#F59E0B' },
    { nome: 'Grave', peso: 3, cor: '#EF4444' },
    { nome: 'Critico', peso: 4, cor: '#7C3AED' },
  ];

  for (const nivel of niveisNC) {
    await prisma.entityData.create({
      data: {
        tenantId: tenant.id,
        entityId: nivelNCEntity.id,
        data: nivel,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }
  console.log('Niveis de NC cadastrados');

  // Quadrantes (baseado na imagem do carro)
  const quadrantes = [
    { nome: 'Frente Centro', codigo: 'FC', posicao: 'frente', coord_x: 50, coord_y: 5 },
    { nome: 'Frente Esquerda', codigo: 'FE', posicao: 'frente', coord_x: 20, coord_y: 5 },
    { nome: 'Frente Direita', codigo: 'FD', posicao: 'frente', coord_x: 80, coord_y: 5 },
    { nome: 'Lateral Esquerda Frente', codigo: 'LEF', posicao: 'lateral_esquerda', coord_x: 5, coord_y: 30 },
    { nome: 'Lateral Esquerda Centro', codigo: 'LEC', posicao: 'lateral_esquerda', coord_x: 5, coord_y: 50 },
    { nome: 'Lateral Esquerda Traseira', codigo: 'LET', posicao: 'lateral_esquerda', coord_x: 5, coord_y: 70 },
    { nome: 'Lateral Direita Frente', codigo: 'LDF', posicao: 'lateral_direita', coord_x: 95, coord_y: 30 },
    { nome: 'Lateral Direita Centro', codigo: 'LDC', posicao: 'lateral_direita', coord_x: 95, coord_y: 50 },
    { nome: 'Lateral Direita Traseira', codigo: 'LDT', posicao: 'lateral_direita', coord_x: 95, coord_y: 70 },
    { nome: 'Traseira Centro', codigo: 'TC', posicao: 'traseira', coord_x: 50, coord_y: 95 },
    { nome: 'Traseira Esquerda', codigo: 'TE', posicao: 'traseira', coord_x: 20, coord_y: 95 },
    { nome: 'Traseira Direita', codigo: 'TD', posicao: 'traseira', coord_x: 80, coord_y: 95 },
    { nome: 'Teto Frente', codigo: 'TF', posicao: 'teto', coord_x: 50, coord_y: 25 },
    { nome: 'Teto Centro', codigo: 'TCT', posicao: 'teto', coord_x: 50, coord_y: 50 },
    { nome: 'Teto Traseiro', codigo: 'TT', posicao: 'teto', coord_x: 50, coord_y: 75 },
  ];

  for (const quadrante of quadrantes) {
    await prisma.entityData.create({
      data: {
        tenantId: tenant.id,
        entityId: quadranteEntity.id,
        data: quadrante,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }
  console.log('Quadrantes cadastrados');

  // 10. Veiculos de exemplo
  const veiculos = [
    {
      chassi: '9BWZZZ377VT004251',
      placa: 'ABC-1234',
      marca: 'Volkswagen',
      modelo: 'Gol',
      ano: 2023,
      cor: 'Branco',
      tipo: 'hatch',
      localizacao: 'Patio A - Vaga 15',
      navio: 'Grande Rio',
      status: 'aprovado',
      situacao: 'novo',
      qtd_nao_conformidades: 0,
    },
    {
      chassi: '9BGRD08X04G117974',
      placa: 'DEF-5678',
      marca: 'Chevrolet',
      modelo: 'Onix',
      ano: 2024,
      cor: 'Prata',
      tipo: 'hatch',
      localizacao: 'Patio B - Vaga 32',
      navio: 'Atlantic Star',
      status: 'em_inspecao',
      situacao: 'novo',
      qtd_nao_conformidades: 2,
    },
    {
      chassi: '93Y4SRD65NJ456789',
      placa: 'GHI-9012',
      marca: 'Fiat',
      modelo: 'Strada',
      ano: 2023,
      cor: 'Vermelho',
      tipo: 'pickup',
      localizacao: 'Patio C - Vaga 8',
      status: 'reprovado',
      situacao: 'sinistrado',
      qtd_nao_conformidades: 5,
      observacoes: 'Veiculo com danos multiplos, necessita reparos extensos',
    },
    {
      chassi: '9BD178227G0123456',
      marca: 'Hyundai',
      modelo: 'HB20',
      ano: 2024,
      cor: 'Azul',
      tipo: 'hatch',
      localizacao: 'Patio A - Vaga 42',
      navio: 'Pacific Dream',
      status: 'aguardando_inspecao',
      situacao: 'novo',
      qtd_nao_conformidades: 0,
    },
    {
      chassi: '9BWDB05U67T654321',
      placa: 'JKL-3456',
      marca: 'Toyota',
      modelo: 'Corolla Cross',
      ano: 2024,
      cor: 'Preto',
      tipo: 'suv',
      localizacao: 'Patio D - Vaga 3',
      status: 'em_reparo',
      situacao: 'usado',
      qtd_nao_conformidades: 3,
    },
  ];

  for (const veiculo of veiculos) {
    await prisma.entityData.create({
      data: {
        tenantId: tenant.id,
        entityId: veiculoEntity.id,
        data: veiculo,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }

  console.log('Veiculos de exemplo criados');

  return { tenant, admin };
}

// ============================================================================
// MAIN
// ============================================================================
export async function seedTenantsMarisaIOS() {
  console.log('\n===================================================');
  console.log('SEED: MARISA DILDA & IOS');
  console.log('===================================================');

  await seedMarisaDilda();
  await seedIOS();

  console.log('\n===================================================');
  console.log('SEED COMPLETO!');
  console.log('===================================================');
  console.log('\nCredenciais de teste:');
  console.log('');
  console.log('MARISA DILDA:');
  console.log('   Admin: admin@marisadilda.com / marisa123');
  console.log('   User:  operador@marisadilda.com / user123');
  console.log('');
  console.log('IOS:');
  console.log('   Admin:    admin@ios.com / ios123');
  console.log('   Gerente:  gerente@ios.com / inspetor123');
  console.log('   Inspetor: inspetor@ios.com / inspetor123');
  console.log('');
  console.log('===================================================\n');
}

// Executar diretamente se chamado como script
if (require.main === module) {
  seedTenantsMarisaIOS()
    .catch((e) => {
      console.error('Erro no seed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
