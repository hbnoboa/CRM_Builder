/**
 * Seed para os modulos iOS Sinistros e iOS Car API
 *
 * Este arquivo cria todas as entidades, dados iniciais e configuracoes
 * necessarias para os sistemas de gestao de sinistros e inspecao de veiculos.
 *
 * Uso:
 *   npx ts-node prisma/seeds/sinistros-veiculos.seed.ts
 *
 * Ou importar a funcao seedSinistrosVeiculos em seed.ts principal
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// PARTE 1: DEFINICOES DE ENTIDADES - SINISTROS
// ============================================================================

const entitiesSinistros = [
  // 1. CategoriaDocumento
  {
    name: 'Categoria Documento',
    namePlural: 'Categorias de Documentos',
    slug: 'categoria-documento',
    description: 'Categorias para classificacao de documentos de sinistros',
    icon: 'folder',
    color: '#6366F1',
    fields: [
      { slug: 'name', name: 'Nome', type: 'text', required: true },
      { slug: 'code', name: 'Codigo', type: 'text', required: true },
    ],
    settings: {
      titleField: 'name',
      subtitleField: 'code',
      searchFields: ['name', 'code'],
      defaultSort: { field: 'name', order: 'asc' },
    },
  },

  // 2. Corretor
  {
    name: 'Corretor',
    namePlural: 'Corretores',
    slug: 'corretor',
    description: 'Cadastro de corretores de seguros',
    icon: 'user-tie',
    color: '#8B5CF6',
    fields: [
      { slug: 'email', name: 'Email', type: 'email', required: true },
      { slug: 'phone', name: 'Telefone', type: 'phone', required: false },
      { slug: 'state', name: 'Estado', type: 'text', required: false },
      { slug: 'city', name: 'Cidade', type: 'text', required: false },
      { slug: 'address', name: 'Endereco', type: 'textarea', required: false },
    ],
    settings: {
      titleField: 'email',
      subtitleField: 'city',
      searchFields: ['email', 'city', 'state'],
      defaultSort: { field: 'email', order: 'asc' },
    },
  },

  // 3. Seguradora
  {
    name: 'Seguradora',
    namePlural: 'Seguradoras',
    slug: 'seguradora',
    description: 'Cadastro de seguradoras',
    icon: 'shield',
    color: '#0EA5E9',
    fields: [
      { slug: 'company_name', name: 'Razao Social', type: 'text', required: true },
      { slug: 'cnpj', name: 'CNPJ', type: 'text', required: false },
      { slug: 'phone', name: 'Telefone', type: 'phone', required: false },
      { slug: 'email', name: 'Email', type: 'email', required: false },
      { slug: 'state', name: 'Estado', type: 'text', required: false },
      { slug: 'city', name: 'Cidade', type: 'text', required: false },
      { slug: 'address', name: 'Endereco', type: 'textarea', required: false },
    ],
    settings: {
      titleField: 'company_name',
      subtitleField: 'cnpj',
      searchFields: ['company_name', 'cnpj', 'email'],
      defaultSort: { field: 'company_name', order: 'asc' },
    },
  },

  // 4. Segurado
  {
    name: 'Segurado',
    namePlural: 'Segurados',
    slug: 'segurado',
    description: 'Cadastro de segurados (empresas ou pessoas)',
    icon: 'building',
    color: '#10B981',
    fields: [
      { slug: 'company_name', name: 'Razao Social', type: 'text', required: true },
      { slug: 'fantasy_name', name: 'Nome Fantasia', type: 'text', required: false },
      { slug: 'cnpj', name: 'CNPJ', type: 'text', required: false },
      { slug: 'email', name: 'Email', type: 'email', required: false },
      { slug: 'state', name: 'Estado', type: 'text', required: false },
      { slug: 'city', name: 'Cidade', type: 'text', required: false },
      { slug: 'address', name: 'Endereco', type: 'textarea', required: false },
      { slug: 'business_field', name: 'Ramo de Atividade', type: 'text', required: false },
    ],
    settings: {
      titleField: 'company_name',
      subtitleField: 'fantasy_name',
      searchFields: ['company_name', 'fantasy_name', 'cnpj', 'email'],
      defaultSort: { field: 'company_name', order: 'asc' },
    },
  },

  // 5. Reguladora
  {
    name: 'Reguladora',
    namePlural: 'Reguladoras',
    slug: 'reguladora',
    description: 'Cadastro de empresas reguladoras',
    icon: 'clipboard-check',
    color: '#F59E0B',
    fields: [
      { slug: 'name', name: 'Nome', type: 'text', required: true },
      { slug: 'cnpj', name: 'CNPJ', type: 'text', required: false },
      { slug: 'phone', name: 'Telefone', type: 'phone', required: false },
      { slug: 'email', name: 'Email', type: 'email', required: false },
    ],
    settings: {
      titleField: 'name',
      subtitleField: 'cnpj',
      searchFields: ['name', 'cnpj', 'email'],
      defaultSort: { field: 'name', order: 'asc' },
    },
  },

  // 6. GerenciadoraRisco
  {
    name: 'Gerenciadora de Risco',
    namePlural: 'Gerenciadoras de Risco',
    slug: 'gerenciadora-risco',
    description: 'Cadastro de gerenciadoras de risco',
    icon: 'alert-triangle',
    color: '#EF4444',
    fields: [
      { slug: 'name', name: 'Nome', type: 'text', required: true },
      { slug: 'cnpj', name: 'CNPJ', type: 'text', required: false },
      { slug: 'phone', name: 'Telefone', type: 'phone', required: false },
      { slug: 'email', name: 'Email', type: 'email', required: false },
    ],
    settings: {
      titleField: 'name',
      subtitleField: 'cnpj',
      searchFields: ['name', 'cnpj', 'email'],
      defaultSort: { field: 'name', order: 'asc' },
    },
  },

  // 7. Transportadora
  {
    name: 'Transportadora',
    namePlural: 'Transportadoras',
    slug: 'transportadora',
    description: 'Cadastro de transportadoras',
    icon: 'truck',
    color: '#14B8A6',
    fields: [
      { slug: 'company_name', name: 'Razao Social', type: 'text', required: true },
      { slug: 'cnpj_cpf', name: 'CNPJ/CPF', type: 'text', required: false },
      { slug: 'email', name: 'Email', type: 'email', required: false },
      { slug: 'rntrc', name: 'RNTRC (Registro ANTT)', type: 'text', required: false },
    ],
    settings: {
      titleField: 'company_name',
      subtitleField: 'cnpj_cpf',
      searchFields: ['company_name', 'cnpj_cpf', 'email', 'rntrc'],
      defaultSort: { field: 'company_name', order: 'asc' },
    },
  },
];

// Entidade principal: Sinistro (com todos os campos)
const sinistroEntity = {
  name: 'Sinistro',
  namePlural: 'Sinistros',
  slug: 'sinistro',
  description: 'Gestao de sinistros de seguros',
  icon: 'file-warning',
  color: '#DC2626',
  fields: [
    // Dados do Corretor
    { slug: 'broker_id', name: 'Corretor', type: 'relation', required: false, relationEntitySlug: 'corretor' },
    { slug: 'broker_name', name: 'Nome Corretor', type: 'text', required: false },
    { slug: 'broker_email', name: 'Email Corretor', type: 'email', required: false },

    // Dados da Seguradora
    { slug: 'insurance_company_id', name: 'Seguradora', type: 'relation', required: false, relationEntitySlug: 'seguradora' },
    { slug: 'insurance_company_name', name: 'Nome Seguradora', type: 'text', required: false },

    // Dados do Segurado
    { slug: 'insured_id', name: 'Segurado', type: 'relation', required: false, relationEntitySlug: 'segurado' },
    { slug: 'insured_name', name: 'Nome Segurado', type: 'text', required: false },
    { slug: 'insured_cnpj', name: 'CNPJ Segurado', type: 'text', required: false },
    { slug: 'insured_email', name: 'Email Segurado', type: 'email', required: false },

    // Dados Regulatorios
    { slug: 'regulator_id', name: 'Reguladora', type: 'relation', required: false, relationEntitySlug: 'reguladora' },
    { slug: 'regulatory', name: 'Nome Reguladora', type: 'text', required: false },
    { slug: 'risk_manager_id', name: 'Gerenciadora de Risco', type: 'relation', required: false, relationEntitySlug: 'gerenciadora-risco' },
    { slug: 'risk_manager_name', name: 'Nome Gerenciadora', type: 'text', required: false },

    // Numeros de Referencia
    { slug: 'policy_number', name: 'Numero da Apolice', type: 'text', required: false },
    { slug: 'line_of_business', name: 'Ramo do Seguro', type: 'text', required: false },
    { slug: 'insurance_claim_number', name: 'Numero Sinistro Seguradora', type: 'text', required: false },
    { slug: 'regulator_claim_number', name: 'Numero Sinistro Reguladora', type: 'text', required: false },

    // Dados Financeiros
    { slug: 'loss_estimation', name: 'Estimativa de Perda', type: 'currency', required: false },
    { slug: 'deductible', name: 'Franquia', type: 'currency', required: false },
    { slug: 'pos', name: 'POS', type: 'text', required: false },
    { slug: 'fixed_loss', name: 'Perda Fixada', type: 'currency', required: false },
    { slug: 'indemnified_loss', name: 'Valor Indenizado', type: 'currency', required: false },
    { slug: 'closing_date', name: 'Data Encerramento', type: 'date', required: false },

    // Dados do Evento
    { slug: 'cause', name: 'Causa', type: 'text', required: false },
    {
      slug: 'cause_type',
      name: 'Tipo da Causa',
      type: 'select',
      required: false,
      options: [
        { value: 'roubo', label: 'Roubo', color: '#EF4444' },
        { value: 'furto', label: 'Furto', color: '#F97316' },
        { value: 'acidente', label: 'Acidente', color: '#F59E0B' },
        { value: 'avaria', label: 'Avaria', color: '#EAB308' },
        { value: 'extravio', label: 'Extravio', color: '#84CC16' },
        { value: 'outros', label: 'Outros', color: '#6B7280' },
      ],
    },
    { slug: 'event_date', name: 'Data do Evento', type: 'date', required: false },
    { slug: 'event_time', name: 'Hora do Evento', type: 'text', required: false },
    { slug: 'notice_date', name: 'Data do Aviso', type: 'date', required: false },
    { slug: 'notice_time', name: 'Hora do Aviso', type: 'text', required: false },
    { slug: 'event_location', name: 'Local do Evento', type: 'map', required: false, mapMode: 'both', mapDefaultZoom: 4, mapHeight: 350 },

    // Dados da Transportadora
    { slug: 'shipping_company_id', name: 'Transportadora', type: 'relation', required: false, relationEntitySlug: 'transportadora' },
    { slug: 'shipping_company_name', name: 'Nome Transportadora', type: 'text', required: false },
    { slug: 'shipping_company_cnpj', name: 'CNPJ Transportadora', type: 'text', required: false },
    { slug: 'shipping_company_email', name: 'Email Transportadora', type: 'email', required: false },

    // Dados do Veiculo
    { slug: 'vehicle_brand', name: 'Marca Veiculo', type: 'text', required: false },
    { slug: 'vehicle_model', name: 'Modelo Veiculo', type: 'text', required: false },
    { slug: 'vehicle_year', name: 'Ano Veiculo', type: 'text', required: false },
    { slug: 'vehicle_plate', name: 'Placa Veiculo', type: 'text', required: false },
    { slug: 'cart_brand', name: 'Marca Carreta', type: 'text', required: false },
    { slug: 'cart_model', name: 'Modelo Carreta', type: 'text', required: false },
    { slug: 'cart_year', name: 'Ano Carreta', type: 'text', required: false },
    { slug: 'cart_plate', name: 'Placa Carreta', type: 'text', required: false },

    // Dados do Motorista
    { slug: 'driver_name', name: 'Nome Motorista', type: 'text', required: false },
    { slug: 'driver_cpf', name: 'CPF Motorista', type: 'text', required: false },
    { slug: 'driver_cnh', name: 'CNH Motorista', type: 'text', required: false },
    { slug: 'birth_year', name: 'Ano Nascimento', type: 'text', required: false },

    // Origem/Destino
    { slug: 'sender_name', name: 'Nome Remetente', type: 'text', required: false },
    { slug: 'origin_city', name: 'Cidade Origem', type: 'text', required: false },
    { slug: 'origin_state', name: 'Estado Origem', type: 'text', required: false },
    { slug: 'receiver_name', name: 'Nome Destinatario', type: 'text', required: false },
    { slug: 'destination_city', name: 'Cidade Destino', type: 'text', required: false },
    { slug: 'destination_state', name: 'Estado Destino', type: 'text', required: false },

    // Dados da Nota/Carga
    { slug: 'invoice_number', name: 'Numero NF', type: 'text', required: false },
    { slug: 'invoice_value', name: 'Valor NF', type: 'currency', required: false },
    { slug: 'goods', name: 'Descricao Mercadoria', type: 'textarea', required: false },
    { slug: 'risk_classification', name: 'Classificacao Risco', type: 'text', required: false },
    { slug: 'cte_number', name: 'Numero CT-e', type: 'text', required: false },
    { slug: 'cte_value', name: 'Valor CT-e', type: 'currency', required: false },
    { slug: 'mdfe_number', name: 'Numero MDF-e', type: 'text', required: false },
    { slug: 'mdfe_value', name: 'Valor MDF-e', type: 'currency', required: false },
    { slug: 'averbacao_number', name: 'Numero Averbacao', type: 'text', required: false },
    { slug: 'averbacao_value', name: 'Valor Averbacao', type: 'currency', required: false },

    // Status
    {
      slug: 'status',
      name: 'Status',
      type: 'select',
      required: true,
      default: 'aberto',
      options: [
        { value: 'aberto', label: 'Aberto', color: '#3B82F6' },
        { value: 'em_analise', label: 'Em Analise', color: '#F59E0B' },
        { value: 'pendente_docs', label: 'Pendente Documentos', color: '#EF4444' },
        { value: 'em_regulacao', label: 'Em Regulacao', color: '#8B5CF6' },
        { value: 'indenizado', label: 'Indenizado', color: '#10B981' },
        { value: 'encerrado', label: 'Encerrado', color: '#6B7280' },
        { value: 'cancelado', label: 'Cancelado', color: '#DC2626' },
      ],
    },

    // Observacoes
    { slug: 'event_description', name: 'Descricao do Evento', type: 'textarea', required: false },
    { slug: 'notes', name: 'Observacoes', type: 'textarea', required: false },
  ],
  settings: {
    titleField: 'insurance_claim_number',
    subtitleField: 'insured_name',
    searchFields: ['insurance_claim_number', 'regulator_claim_number', 'insured_name', 'driver_name', 'vehicle_plate'],
    defaultSort: { field: 'createdAt', order: 'desc' },
  },
};

// Entidade: SinistroFollowup
const sinistroFollowupEntity = {
  name: 'Follow-up Sinistro',
  namePlural: 'Follow-ups de Sinistros',
  slug: 'sinistro-followup',
  description: 'Acompanhamento de acoes dos sinistros',
  icon: 'message-square',
  color: '#0EA5E9',
  fields: [
    { slug: 'sinistro_id', name: 'Sinistro', type: 'relation', required: true, relationEntitySlug: 'sinistro' },
    { slug: 'datetime', name: 'Data/Hora', type: 'date', required: true },
    { slug: 'actions', name: 'Acoes Realizadas', type: 'textarea', required: true },
    { slug: 'user_name', name: 'Usuario', type: 'text', required: false },
    { slug: 'return_date', name: 'Data Retorno', type: 'date', required: false },
  ],
  settings: {
    titleField: 'datetime',
    subtitleField: 'actions',
    searchFields: ['actions', 'user_name'],
    defaultSort: { field: 'datetime', order: 'desc' },
  },
};

// Entidade: SinistroArquivo
const sinistroArquivoEntity = {
  name: 'Arquivo Sinistro',
  namePlural: 'Arquivos de Sinistros',
  slug: 'sinistro-arquivo',
  description: 'Documentos anexados aos sinistros',
  icon: 'file',
  color: '#6366F1',
  fields: [
    { slug: 'sinistro_id', name: 'Sinistro', type: 'relation', required: true, relationEntitySlug: 'sinistro' },
    { slug: 'datetime', name: 'Data Upload', type: 'date', required: true },
    { slug: 'category_id', name: 'Categoria', type: 'relation', required: false, relationEntitySlug: 'categoria-documento' },
    { slug: 'originalname', name: 'Nome Original', type: 'text', required: false },
    { slug: 'filename', name: 'Nome Armazenado', type: 'text', required: false },
    { slug: 'file_url', name: 'URL do Arquivo', type: 'url', required: false },
  ],
  settings: {
    titleField: 'originalname',
    subtitleField: 'datetime',
    searchFields: ['originalname'],
    defaultSort: { field: 'datetime', order: 'desc' },
  },
};

// ============================================================================
// PARTE 2: DEFINICOES DE ENTIDADES - VEICULOS
// ============================================================================

const entitiesVeiculos = [
  // 1. PecaVeiculo
  {
    name: 'Peca Veiculo',
    namePlural: 'Pecas de Veiculo',
    slug: 'peca-veiculo',
    description: 'Cadastro de pecas de veiculo para inspecao',
    icon: 'cog',
    color: '#64748B',
    fields: [
      { slug: 'area', name: 'Area', type: 'number', required: false },
      { slug: 'name', name: 'Nome', type: 'text', required: true },
    ],
    settings: {
      titleField: 'name',
      subtitleField: 'area',
      searchFields: ['name'],
      defaultSort: { field: 'area', order: 'asc' },
    },
  },

  // 2. TipoNaoConformidade
  {
    name: 'Tipo Nao Conformidade',
    namePlural: 'Tipos de Nao Conformidade',
    slug: 'tipo-nao-conformidade',
    description: 'Tipos de nao-conformidades para inspecao',
    icon: 'alert-circle',
    color: '#EF4444',
    fields: [
      { slug: 'nctype', name: 'Tipo', type: 'text', required: true },
    ],
    settings: {
      titleField: 'nctype',
      searchFields: ['nctype'],
      defaultSort: { field: 'nctype', order: 'asc' },
    },
  },

  // 3. NivelNaoConformidade
  {
    name: 'Nivel Nao Conformidade',
    namePlural: 'Niveis de Nao Conformidade',
    slug: 'nivel-nao-conformidade',
    description: 'Niveis de gravidade das nao-conformidades',
    icon: 'thermometer',
    color: '#F59E0B',
    fields: [
      { slug: 'level', name: 'Nivel', type: 'text', required: true },
    ],
    settings: {
      titleField: 'level',
      searchFields: ['level'],
      defaultSort: { field: 'level', order: 'asc' },
    },
  },

  // 4. Quadrante
  {
    name: 'Quadrante',
    namePlural: 'Quadrantes',
    slug: 'quadrante',
    description: 'Quadrantes para localizacao de danos',
    icon: 'grid',
    color: '#8B5CF6',
    fields: [
      { slug: 'option', name: 'Opcao', type: 'number', required: true },
    ],
    settings: {
      titleField: 'option',
      searchFields: [],
      defaultSort: { field: 'option', order: 'asc' },
    },
  },

  // 5. Medida
  {
    name: 'Medida',
    namePlural: 'Medidas',
    slug: 'medida',
    description: 'Medidas para dimensionamento de danos',
    icon: 'ruler',
    color: '#0EA5E9',
    fields: [
      { slug: 'size', name: 'Tamanho', type: 'text', required: true },
    ],
    settings: {
      titleField: 'size',
      searchFields: ['size'],
      defaultSort: { field: 'size', order: 'asc' },
    },
  },

  // 6. LocalNaoConformidade
  {
    name: 'Local Nao Conformidade',
    namePlural: 'Locais de Nao Conformidade',
    slug: 'local-nao-conformidade',
    description: 'Locais onde podem ocorrer nao-conformidades',
    icon: 'map-pin',
    color: '#10B981',
    fields: [
      { slug: 'local', name: 'Local', type: 'text', required: true },
    ],
    settings: {
      titleField: 'local',
      searchFields: ['local'],
      defaultSort: { field: 'local', order: 'asc' },
    },
  },
];

// Entidade principal: Veiculo
const veiculoEntity = {
  name: 'Veiculo',
  namePlural: 'Veiculos',
  slug: 'veiculo',
  description: 'Cadastro de veiculos para inspecao',
  icon: 'car',
  color: '#3B82F6',
  fields: [
    { slug: 'chassis', name: 'Chassi', type: 'text', required: true },
    { slug: 'location', name: 'Localizacao', type: 'text', required: false },
    { slug: 'type', name: 'Tipo', type: 'text', required: false },
    { slug: 'brand', name: 'Marca', type: 'text', required: false },
    { slug: 'travel', name: 'Viagem', type: 'text', required: false },
    { slug: 'model', name: 'Modelo', type: 'text', required: false },
    {
      slug: 'status',
      name: 'Status',
      type: 'select',
      required: false,
      options: [
        { value: 'aguardando', label: 'Aguardando', color: '#F59E0B' },
        { value: 'em_inspecao', label: 'Em Inspecao', color: '#3B82F6' },
        { value: 'aprovado', label: 'Aprovado', color: '#10B981' },
        { value: 'reprovado', label: 'Reprovado', color: '#EF4444' },
        { value: 'liberado', label: 'Liberado', color: '#6B7280' },
      ],
    },
    { slug: 'ship', name: 'Navio', type: 'text', required: false },
    {
      slug: 'situation',
      name: 'Situacao',
      type: 'select',
      required: false,
      options: [
        { value: 'novo', label: 'Novo', color: '#10B981' },
        { value: 'usado', label: 'Usado', color: '#F59E0B' },
        { value: 'danificado', label: 'Danificado', color: '#EF4444' },
      ],
    },
    { slug: 'observations', name: 'Observacoes', type: 'textarea', required: false },
    {
      slug: 'done',
      name: 'Concluido',
      type: 'select',
      required: false,
      default: 'no',
      options: [
        { value: 'yes', label: 'Sim', color: '#10B981' },
        { value: 'no', label: 'Nao', color: '#EF4444' },
      ],
    },
    { slug: 'etChassisImageFilename', name: 'Imagem Chassi', type: 'text', required: false },
    { slug: 'profileImageFilename', name: 'Imagem Perfil', type: 'text', required: false },
  ],
  settings: {
    titleField: 'chassis',
    subtitleField: 'model',
    searchFields: ['chassis', 'brand', 'model', 'ship', 'travel'],
    defaultSort: { field: 'createdAt', order: 'desc' },
  },
};

// Entidade: NaoConformidade
const naoConformidadeEntity = {
  name: 'Nao Conformidade',
  namePlural: 'Nao Conformidades',
  slug: 'nao-conformidade',
  description: 'Registro de nao-conformidades em veiculos',
  icon: 'x-circle',
  color: '#DC2626',
  fields: [
    { slug: 'veiculo_id', name: 'Veiculo', type: 'relation', required: true, relationEntitySlug: 'veiculo' },
    { slug: 'peca_veiculo_id', name: 'Peca do Veiculo', type: 'relation', required: false, relationEntitySlug: 'peca-veiculo' },
    { slug: 'tipo_id', name: 'Tipo', type: 'relation', required: false, relationEntitySlug: 'tipo-nao-conformidade' },
    { slug: 'nivel_id', name: 'Nivel', type: 'relation', required: false, relationEntitySlug: 'nivel-nao-conformidade' },
    { slug: 'quadrante_id', name: 'Quadrante', type: 'relation', required: false, relationEntitySlug: 'quadrante' },
    { slug: 'medida_id', name: 'Medida', type: 'relation', required: false, relationEntitySlug: 'medida' },
    { slug: 'local_id', name: 'Local', type: 'relation', required: false, relationEntitySlug: 'local-nao-conformidade' },
    { slug: 'image1', name: 'Imagem 1', type: 'text', required: false },
    { slug: 'image2', name: 'Imagem 2', type: 'text', required: false },
    { slug: 'description', name: 'Descricao', type: 'textarea', required: false },
  ],
  settings: {
    titleField: 'veiculo_id',
    searchFields: ['description'],
    defaultSort: { field: 'createdAt', order: 'desc' },
  },
};

// ============================================================================
// PARTE 3: DADOS INICIAIS
// ============================================================================

// Categorias de Documento iniciais
const categoriasDocumento = [
  { name: 'Nota Fiscal', code: 'NF' },
  { name: 'Conhecimento de Transporte', code: 'CTE' },
  { name: 'Manifesto de Documentos Fiscais', code: 'MDFE' },
  { name: 'Averbacao', code: 'AVERBACAO' },
  { name: 'Carteira Nacional de Habilitacao', code: 'CNH' },
  { name: 'Boletim de Ocorrencia', code: 'BOLETIM_OCORRENCIA' },
  { name: 'Boletim de Furto', code: 'BOLETIM_FURTO' },
  { name: 'Declaracao do Motorista', code: 'DECLARACAO_MOTORISTA' },
  { name: 'Documentos do Veiculo', code: 'DOCS_VEICULO' },
  { name: 'Tacografo', code: 'TACOGRAFO' },
  { name: 'Documentos de Terceiros', code: 'DOCS_TERCEIROS' },
  { name: 'Fotos do Sinistro', code: 'FOTOS_SINISTRO' },
  { name: 'Relatorios de Monitoramento', code: 'RELATORIOS_MONITORAMENTO' },
  { name: 'Relatorio da Reguladora', code: 'RELATORIO_REGULADORA' },
];

// Pecas de Veiculo iniciais
const pecasVeiculo = [
  { area: 1, name: 'Para-choque dianteiro' },
  { area: 1, name: 'Grade' },
  { area: 1, name: 'Farol esquerdo' },
  { area: 1, name: 'Farol direito' },
  { area: 2, name: 'Capo' },
  { area: 2, name: 'Para-brisa' },
  { area: 3, name: 'Porta dianteira esquerda' },
  { area: 3, name: 'Porta dianteira direita' },
  { area: 3, name: 'Retrovisor esquerdo' },
  { area: 3, name: 'Retrovisor direito' },
  { area: 4, name: 'Porta traseira esquerda' },
  { area: 4, name: 'Porta traseira direita' },
  { area: 5, name: 'Teto' },
  { area: 6, name: 'Tampa traseira' },
  { area: 6, name: 'Para-choque traseiro' },
  { area: 6, name: 'Lanterna esquerda' },
  { area: 6, name: 'Lanterna direita' },
  { area: 7, name: 'Roda dianteira esquerda' },
  { area: 7, name: 'Roda dianteira direita' },
  { area: 7, name: 'Roda traseira esquerda' },
  { area: 7, name: 'Roda traseira direita' },
  { area: 8, name: 'Assoalho' },
  { area: 8, name: 'Interior' },
];

// Tipos de Nao Conformidade iniciais
const tiposNaoConformidade = [
  { nctype: 'Amassado' },
  { nctype: 'Riscado' },
  { nctype: 'Trincado' },
  { nctype: 'Quebrado' },
  { nctype: 'Faltante' },
  { nctype: 'Desalinhado' },
  { nctype: 'Manchado' },
  { nctype: 'Oxidado' },
  { nctype: 'Descascado' },
  { nctype: 'Deformado' },
];

// Niveis de Nao Conformidade iniciais
const niveisNaoConformidade = [
  { level: 'Leve' },
  { level: 'Medio' },
  { level: 'Grave' },
  { level: 'Critico' },
];

// Quadrantes iniciais
const quadrantes = [
  { option: 1 },
  { option: 2 },
  { option: 3 },
  { option: 4 },
  { option: 5 },
  { option: 6 },
  { option: 7 },
  { option: 8 },
  { option: 9 },
];

// Medidas iniciais
const medidas = [
  { size: '1cm' },
  { size: '2cm' },
  { size: '5cm' },
  { size: '10cm' },
  { size: '15cm' },
  { size: '20cm' },
  { size: '30cm' },
  { size: '50cm' },
  { size: 'Maior que 50cm' },
];

// Locais de Nao Conformidade iniciais
const locaisNaoConformidade = [
  { local: 'Externo' },
  { local: 'Interno' },
  { local: 'Motor' },
  { local: 'Chassi' },
  { local: 'Suspensao' },
];

// ============================================================================
// PARTE 4: FUNCAO PRINCIPAL DE SEED
// ============================================================================

export async function seedSinistrosVeiculos(tenantId: string, adminUserId: string) {
  console.log('\n=== Iniciando seed de Sinistros e Veiculos ===\n');

  const createdEntities: Record<string, string> = {};

  // Criar entidades de suporte - Sinistros
  console.log('Criando entidades de suporte - Sinistros...');
  for (const entityDef of entitiesSinistros) {
    const entity = await prisma.entity.upsert({
      where: {
        tenantId_slug: {
          tenantId,
          slug: entityDef.slug,
        },
      },
      update: {},
      create: {
        tenantId,
        name: entityDef.name,
        namePlural: entityDef.namePlural,
        slug: entityDef.slug,
        description: entityDef.description,
        icon: entityDef.icon,
        color: entityDef.color,
        fields: entityDef.fields,
        settings: entityDef.settings,
      },
    });
    createdEntities[entityDef.slug] = entity.id;
    console.log(`  - ${entityDef.name} criada`);
  }

  // Criar entidades de suporte - Veiculos
  console.log('\nCriando entidades de suporte - Veiculos...');
  for (const entityDef of entitiesVeiculos) {
    const entity = await prisma.entity.upsert({
      where: {
        tenantId_slug: {
          tenantId,
          slug: entityDef.slug,
        },
      },
      update: {},
      create: {
        tenantId,
        name: entityDef.name,
        namePlural: entityDef.namePlural,
        slug: entityDef.slug,
        description: entityDef.description,
        icon: entityDef.icon,
        color: entityDef.color,
        fields: entityDef.fields,
        settings: entityDef.settings,
      },
    });
    createdEntities[entityDef.slug] = entity.id;
    console.log(`  - ${entityDef.name} criada`);
  }

  // Criar entidade Sinistro principal
  console.log('\nCriando entidade Sinistro...');
  const sinistro = await prisma.entity.upsert({
    where: {
      tenantId_slug: {
        tenantId,
        slug: sinistroEntity.slug,
      },
    },
    update: {},
    create: {
      tenantId,
      name: sinistroEntity.name,
      namePlural: sinistroEntity.namePlural,
      slug: sinistroEntity.slug,
      description: sinistroEntity.description,
      icon: sinistroEntity.icon,
      color: sinistroEntity.color,
      fields: sinistroEntity.fields,
      settings: sinistroEntity.settings,
    },
  });
  createdEntities['sinistro'] = sinistro.id;
  console.log(`  - Sinistro criada`);

  // Criar entidades relacionadas ao Sinistro
  console.log('\nCriando entidades relacionadas ao Sinistro...');

  const followup = await prisma.entity.upsert({
    where: {
      tenantId_slug: {
        tenantId,
        slug: sinistroFollowupEntity.slug,
      },
    },
    update: {},
    create: {
      tenantId,
      name: sinistroFollowupEntity.name,
      namePlural: sinistroFollowupEntity.namePlural,
      slug: sinistroFollowupEntity.slug,
      description: sinistroFollowupEntity.description,
      icon: sinistroFollowupEntity.icon,
      color: sinistroFollowupEntity.color,
      fields: sinistroFollowupEntity.fields,
      settings: sinistroFollowupEntity.settings,
    },
  });
  createdEntities['sinistro-followup'] = followup.id;
  console.log(`  - SinistroFollowup criada`);

  const arquivo = await prisma.entity.upsert({
    where: {
      tenantId_slug: {
        tenantId,
        slug: sinistroArquivoEntity.slug,
      },
    },
    update: {},
    create: {
      tenantId,
      name: sinistroArquivoEntity.name,
      namePlural: sinistroArquivoEntity.namePlural,
      slug: sinistroArquivoEntity.slug,
      description: sinistroArquivoEntity.description,
      icon: sinistroArquivoEntity.icon,
      color: sinistroArquivoEntity.color,
      fields: sinistroArquivoEntity.fields,
      settings: sinistroArquivoEntity.settings,
    },
  });
  createdEntities['sinistro-arquivo'] = arquivo.id;
  console.log(`  - SinistroArquivo criada`);

  // Criar entidade Veiculo principal
  console.log('\nCriando entidade Veiculo...');
  const veiculo = await prisma.entity.upsert({
    where: {
      tenantId_slug: {
        tenantId,
        slug: veiculoEntity.slug,
      },
    },
    update: {},
    create: {
      tenantId,
      name: veiculoEntity.name,
      namePlural: veiculoEntity.namePlural,
      slug: veiculoEntity.slug,
      description: veiculoEntity.description,
      icon: veiculoEntity.icon,
      color: veiculoEntity.color,
      fields: veiculoEntity.fields,
      settings: veiculoEntity.settings,
    },
  });
  createdEntities['veiculo'] = veiculo.id;
  console.log(`  - Veiculo criada`);

  // Criar entidade NaoConformidade
  console.log('\nCriando entidade NaoConformidade...');
  const nc = await prisma.entity.upsert({
    where: {
      tenantId_slug: {
        tenantId,
        slug: naoConformidadeEntity.slug,
      },
    },
    update: {},
    create: {
      tenantId,
      name: naoConformidadeEntity.name,
      namePlural: naoConformidadeEntity.namePlural,
      slug: naoConformidadeEntity.slug,
      description: naoConformidadeEntity.description,
      icon: naoConformidadeEntity.icon,
      color: naoConformidadeEntity.color,
      fields: naoConformidadeEntity.fields,
      settings: naoConformidadeEntity.settings,
    },
  });
  createdEntities['nao-conformidade'] = nc.id;
  console.log(`  - NaoConformidade criada`);

  // Inserir dados iniciais
  console.log('\nInserindo dados iniciais...');

  // Categorias de Documento
  console.log('  Inserindo categorias de documento...');
  for (const cat of categoriasDocumento) {
    const exists = await prisma.entityData.findFirst({
      where: {
        tenantId,
        entityId: createdEntities['categoria-documento'],
        data: {
          path: ['code'],
          equals: cat.code,
        },
      },
    });
    if (!exists) {
      await prisma.entityData.create({
        data: {
          tenantId,
          entityId: createdEntities['categoria-documento'],
          data: cat,
          createdById: adminUserId,
          updatedById: adminUserId,
        },
      });
    }
  }
  console.log(`    ${categoriasDocumento.length} categorias inseridas`);

  // Pecas de Veiculo
  console.log('  Inserindo pecas de veiculo...');
  for (const peca of pecasVeiculo) {
    const exists = await prisma.entityData.findFirst({
      where: {
        tenantId,
        entityId: createdEntities['peca-veiculo'],
        data: {
          path: ['name'],
          equals: peca.name,
        },
      },
    });
    if (!exists) {
      await prisma.entityData.create({
        data: {
          tenantId,
          entityId: createdEntities['peca-veiculo'],
          data: peca,
          createdById: adminUserId,
          updatedById: adminUserId,
        },
      });
    }
  }
  console.log(`    ${pecasVeiculo.length} pecas inseridas`);

  // Tipos de Nao Conformidade
  console.log('  Inserindo tipos de nao conformidade...');
  for (const tipo of tiposNaoConformidade) {
    const exists = await prisma.entityData.findFirst({
      where: {
        tenantId,
        entityId: createdEntities['tipo-nao-conformidade'],
        data: {
          path: ['nctype'],
          equals: tipo.nctype,
        },
      },
    });
    if (!exists) {
      await prisma.entityData.create({
        data: {
          tenantId,
          entityId: createdEntities['tipo-nao-conformidade'],
          data: tipo,
          createdById: adminUserId,
          updatedById: adminUserId,
        },
      });
    }
  }
  console.log(`    ${tiposNaoConformidade.length} tipos inseridos`);

  // Niveis de Nao Conformidade
  console.log('  Inserindo niveis de nao conformidade...');
  for (const nivel of niveisNaoConformidade) {
    const exists = await prisma.entityData.findFirst({
      where: {
        tenantId,
        entityId: createdEntities['nivel-nao-conformidade'],
        data: {
          path: ['level'],
          equals: nivel.level,
        },
      },
    });
    if (!exists) {
      await prisma.entityData.create({
        data: {
          tenantId,
          entityId: createdEntities['nivel-nao-conformidade'],
          data: nivel,
          createdById: adminUserId,
          updatedById: adminUserId,
        },
      });
    }
  }
  console.log(`    ${niveisNaoConformidade.length} niveis inseridos`);

  // Quadrantes
  console.log('  Inserindo quadrantes...');
  for (const quadrante of quadrantes) {
    const exists = await prisma.entityData.findFirst({
      where: {
        tenantId,
        entityId: createdEntities['quadrante'],
        data: {
          path: ['option'],
          equals: quadrante.option,
        },
      },
    });
    if (!exists) {
      await prisma.entityData.create({
        data: {
          tenantId,
          entityId: createdEntities['quadrante'],
          data: quadrante,
          createdById: adminUserId,
          updatedById: adminUserId,
        },
      });
    }
  }
  console.log(`    ${quadrantes.length} quadrantes inseridos`);

  // Medidas
  console.log('  Inserindo medidas...');
  for (const medida of medidas) {
    const exists = await prisma.entityData.findFirst({
      where: {
        tenantId,
        entityId: createdEntities['medida'],
        data: {
          path: ['size'],
          equals: medida.size,
        },
      },
    });
    if (!exists) {
      await prisma.entityData.create({
        data: {
          tenantId,
          entityId: createdEntities['medida'],
          data: medida,
          createdById: adminUserId,
          updatedById: adminUserId,
        },
      });
    }
  }
  console.log(`    ${medidas.length} medidas inseridas`);

  // Locais de Nao Conformidade
  console.log('  Inserindo locais de nao conformidade...');
  for (const local of locaisNaoConformidade) {
    const exists = await prisma.entityData.findFirst({
      where: {
        tenantId,
        entityId: createdEntities['local-nao-conformidade'],
        data: {
          path: ['local'],
          equals: local.local,
        },
      },
    });
    if (!exists) {
      await prisma.entityData.create({
        data: {
          tenantId,
          entityId: createdEntities['local-nao-conformidade'],
          data: local,
          createdById: adminUserId,
          updatedById: adminUserId,
        },
      });
    }
  }
  console.log(`    ${locaisNaoConformidade.length} locais inseridos`);

  console.log('\n=== Seed de Sinistros e Veiculos concluido ===\n');
  console.log('Entidades criadas:');
  console.log('  SINISTROS:');
  console.log('    - categoria-documento');
  console.log('    - corretor');
  console.log('    - seguradora');
  console.log('    - segurado');
  console.log('    - reguladora');
  console.log('    - gerenciadora-risco');
  console.log('    - transportadora');
  console.log('    - sinistro');
  console.log('    - sinistro-followup');
  console.log('    - sinistro-arquivo');
  console.log('  VEICULOS:');
  console.log('    - peca-veiculo');
  console.log('    - tipo-nao-conformidade');
  console.log('    - nivel-nao-conformidade');
  console.log('    - quadrante');
  console.log('    - medida');
  console.log('    - local-nao-conformidade');
  console.log('    - veiculo');
  console.log('    - nao-conformidade');

  return createdEntities;
}

// ============================================================================
// EXECUCAO STANDALONE
// ============================================================================

async function main() {
  // Buscar tenant demo e admin user
  const demoTenant = await prisma.tenant.findUnique({
    where: { slug: 'demo' },
  });

  if (!demoTenant) {
    console.error('Tenant "demo" nao encontrado. Execute o seed principal primeiro.');
    process.exit(1);
  }

  const adminUser = await prisma.user.findFirst({
    where: {
      tenantId: demoTenant.id,
      email: 'admin@demo.com',
    },
  });

  if (!adminUser) {
    console.error('Usuario admin nao encontrado. Execute o seed principal primeiro.');
    process.exit(1);
  }

  await seedSinistrosVeiculos(demoTenant.id, adminUser.id);
}

// Executar apenas se for o arquivo principal
if (require.main === module) {
  main()
    .catch((e) => {
      console.error('Erro no seed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
