/**
 * Seed para Pages dos modulos iOS Sinistros e iOS Car API
 *
 * Este arquivo cria todas as pages de CRUD para os sistemas
 * de gestao de sinistros e inspecao de veiculos usando Puck.
 *
 * Uso:
 *   npx ts-node prisma/seeds/pages.seed.ts
 *
 * Ou importar a funcao seedPages em seed.ts principal
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// HELPERS PARA GERACAO DE CONTEUDO PUCK
// ============================================================================

type FieldConfig = {
  slug: string;
  name: string;
  type: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  relationEntitySlug?: string;
};

// Gera uma pagina de listagem (DataTable)
function generateListPage(config: {
  title: string;
  entitySlug: string;
  columns: string[];
  searchFields?: string[];
  createLink?: string;
}) {
  return {
    content: [
      {
        type: 'Section',
        props: {
          id: 'section-1',
          padding: 'medium',
          background: 'transparent',
        },
      },
      {
        type: 'Heading',
        props: {
          id: 'heading-1',
          text: config.title,
          level: 'h1',
          align: 'left',
        },
      },
      {
        type: 'Spacer',
        props: {
          id: 'spacer-1',
          size: 'md',
        },
      },
      {
        type: 'FlexRow',
        props: {
          id: 'flex-1',
          justify: 'space-between',
          align: 'center',
          gap: 'md',
        },
      },
      ...(config.searchFields && config.searchFields.length > 0
        ? [
            {
              type: 'TextInput',
              props: {
                id: 'search-input',
                label: 'Buscar',
                placeholder: 'Digite para buscar...',
                fieldName: 'search',
              },
            },
          ]
        : []),
      ...(config.createLink
        ? [
            {
              type: 'Button',
              props: {
                id: 'btn-create',
                text: 'Novo',
                variant: 'primary',
                href: config.createLink,
                icon: 'plus',
              },
            },
          ]
        : []),
      {
        type: 'Spacer',
        props: {
          id: 'spacer-2',
          size: 'md',
        },
      },
      {
        type: 'DateTable',
        props: {
          id: 'data-table',
          entitySlug: config.entitySlug,
          columns: config.columns.map((col) => ({
            field: col,
            label: col.charAt(0).toUpperCase() + col.slice(1).replace(/_/g, ' '),
          })),
          showPagination: true,
          pageSize: 10,
          showActions: true,
          editPath: `/${config.entitySlug}/{{id}}/edit`,
          viewPath: `/${config.entitySlug}/{{id}}`,
        },
      },
    ],
    root: {
      props: {
        title: config.title,
      },
    },
  };
}

// Gera uma pagina de formulario (Create/Edit)
function generateFormPage(config: {
  title: string;
  entitySlug: string;
  fields: FieldConfig[];
  isEdit?: boolean;
  returnPath: string;
}) {
  const formFields = config.fields.map((field, index) => {
    const baseProps = {
      id: `field-${field.slug}`,
      label: field.name,
      fieldName: field.slug,
      required: field.required || false,
      placeholder: `Digite ${field.name.toLowerCase()}...`,
    };

    switch (field.type) {
      case 'email':
        return {
          type: 'EmailInput',
          props: baseProps,
        };
      case 'phone':
        return {
          type: 'PhoneInput',
          props: baseProps,
        };
      case 'textarea':
        return {
          type: 'TextAreaField',
          props: {
            ...baseProps,
            rows: 4,
          },
        };
      case 'number':
      case 'currency':
        return {
          type: 'NumberInput',
          props: {
            ...baseProps,
            min: 0,
          },
        };
      case 'date':
        return {
          type: 'DatePickerField',
          props: {
            ...baseProps,
            showTime: false,
          },
        };
      case 'select':
        return {
          type: 'SelectField',
          props: {
            ...baseProps,
            options:
              field.options?.map((opt) => ({
                value: opt.value,
                label: opt.label,
              })) || [],
          },
        };
      case 'relation':
        return {
          type: 'SelectField',
          props: {
            ...baseProps,
            dataSource: 'api',
            apiPath: `/${field.relationEntitySlug}`,
            valueField: 'id',
            labelField: 'name',
          },
        };
      default:
        return {
          type: 'TextInput',
          props: baseProps,
        };
    }
  });

  return {
    content: [
      {
        type: 'Section',
        props: {
          id: 'section-1',
          padding: 'medium',
          background: 'transparent',
        },
      },
      {
        type: 'FlexRow',
        props: {
          id: 'header-row',
          justify: 'space-between',
          align: 'center',
        },
      },
      {
        type: 'Heading',
        props: {
          id: 'heading-1',
          text: config.title,
          level: 'h1',
          align: 'left',
        },
      },
      {
        type: 'Button',
        props: {
          id: 'btn-back',
          text: 'Voltar',
          variant: 'outline',
          href: config.returnPath,
          icon: 'arrow-left',
        },
      },
      {
        type: 'Spacer',
        props: {
          id: 'spacer-1',
          size: 'lg',
        },
      },
      {
        type: 'Form',
        props: {
          id: 'entity-form',
          entitySlug: config.entitySlug,
          mode: config.isEdit ? 'edit' : 'create',
          submitText: config.isEdit ? 'Salvar' : 'Criar',
          cancelText: 'Cancelar',
          cancelHref: config.returnPath,
          fields: config.fields.map((f) => f.slug),
          events: [
            {
              type: 'onSuccess',
              actions: [
                {
                  type: 'navigate',
                  navigateTo: config.returnPath,
                },
                {
                  type: 'showToast',
                  toastMessage: config.isEdit ? 'Registro atualizado!' : 'Registro criado!',
                  toastType: 'success',
                },
              ],
            },
          ],
        },
      },
      {
        type: 'Grid',
        props: {
          id: 'form-grid',
          columns: 2,
          gap: 'md',
        },
      },
      ...formFields,
    ],
    root: {
      props: {
        title: config.title,
      },
    },
  };
}

// Gera uma pagina de visualizacao (View)
function generateViewPage(config: {
  title: string;
  entitySlug: string;
  fields: { slug: string; label: string; type?: string }[];
  editPath: string;
  returnPath: string;
  relatedEntities?: {
    title: string;
    entitySlug: string;
    relationField: string;
    displayFields: string[];
  }[];
}) {
  return {
    content: [
      {
        type: 'Section',
        props: {
          id: 'section-1',
          padding: 'medium',
          background: 'transparent',
        },
      },
      {
        type: 'FlexRow',
        props: {
          id: 'header-row',
          justify: 'space-between',
          align: 'center',
        },
      },
      {
        type: 'Heading',
        props: {
          id: 'heading-1',
          text: config.title,
          level: 'h1',
          align: 'left',
        },
      },
      {
        type: 'FlexRow',
        props: {
          id: 'actions-row',
          gap: 'sm',
        },
      },
      {
        type: 'Button',
        props: {
          id: 'btn-back',
          text: 'Voltar',
          variant: 'outline',
          href: config.returnPath,
          icon: 'arrow-left',
        },
      },
      {
        type: 'Button',
        props: {
          id: 'btn-edit',
          text: 'Editar',
          variant: 'primary',
          href: config.editPath,
          icon: 'pencil',
        },
      },
      {
        type: 'Spacer',
        props: {
          id: 'spacer-1',
          size: 'lg',
        },
      },
      {
        type: 'DetailView',
        props: {
          id: 'detail-view',
          entitySlug: config.entitySlug,
          layout: 'card',
          columns: 2,
          fields: config.fields.map((f) => ({
            field: f.slug,
            label: f.label,
            type: f.type || 'text',
          })),
        },
      },
      ...(config.relatedEntities
        ? config.relatedEntities.flatMap((rel) => [
            {
              type: 'Spacer',
              props: {
                id: `spacer-rel-${rel.entitySlug}`,
                size: 'xl',
              },
            },
            {
              type: 'Heading',
              props: {
                id: `heading-rel-${rel.entitySlug}`,
                text: rel.title,
                level: 'h2',
                align: 'left',
              },
            },
            {
              type: 'Spacer',
              props: {
                id: `spacer-rel-${rel.entitySlug}-2`,
                size: 'md',
              },
            },
            {
              type: 'RelatedRecords',
              props: {
                id: `related-${rel.entitySlug}`,
                entitySlug: rel.entitySlug,
                relationField: rel.relationField,
                displayFields: rel.displayFields,
                layout: 'table',
              },
            },
          ])
        : []),
    ],
    root: {
      props: {
        title: config.title,
      },
    },
  };
}

// ============================================================================
// DEFINICOES DE PAGES - SINISTROS
// ============================================================================

interface PageDefinition {
  title: string;
  slug: string;
  description: string;
  icon: string;
  contentGenerator: () => object;
}

// Campos simplificados para cada entity de suporte
const corretorFields: FieldConfig[] = [
  { slug: 'email', name: 'Email', type: 'email', required: true },
  { slug: 'phone', name: 'Telefone', type: 'phone' },
  { slug: 'state', name: 'Estado', type: 'text' },
  { slug: 'city', name: 'Cidade', type: 'text' },
  { slug: 'address', name: 'Endereco', type: 'textarea' },
];

const seguradoraFields: FieldConfig[] = [
  { slug: 'company_name', name: 'Razao Social', type: 'text', required: true },
  { slug: 'cnpj', name: 'CNPJ', type: 'text' },
  { slug: 'phone', name: 'Telefone', type: 'phone' },
  { slug: 'email', name: 'Email', type: 'email' },
  { slug: 'state', name: 'Estado', type: 'text' },
  { slug: 'city', name: 'Cidade', type: 'text' },
  { slug: 'address', name: 'Endereco', type: 'textarea' },
];

const seguradoFields: FieldConfig[] = [
  { slug: 'company_name', name: 'Razao Social', type: 'text', required: true },
  { slug: 'fantasy_name', name: 'Nome Fantasia', type: 'text' },
  { slug: 'cnpj', name: 'CNPJ', type: 'text' },
  { slug: 'email', name: 'Email', type: 'email' },
  { slug: 'state', name: 'Estado', type: 'text' },
  { slug: 'city', name: 'Cidade', type: 'text' },
  { slug: 'address', name: 'Endereco', type: 'textarea' },
  { slug: 'business_field', name: 'Ramo de Atividade', type: 'text' },
];

const reguladoraFields: FieldConfig[] = [
  { slug: 'name', name: 'Nome', type: 'text', required: true },
  { slug: 'cnpj', name: 'CNPJ', type: 'text' },
  { slug: 'phone', name: 'Telefone', type: 'phone' },
  { slug: 'email', name: 'Email', type: 'email' },
];

const gerenciadoraRiscoFields: FieldConfig[] = [
  { slug: 'name', name: 'Nome', type: 'text', required: true },
  { slug: 'cnpj', name: 'CNPJ', type: 'text' },
  { slug: 'phone', name: 'Telefone', type: 'phone' },
  { slug: 'email', name: 'Email', type: 'email' },
];

const transportadoraFields: FieldConfig[] = [
  { slug: 'company_name', name: 'Razao Social', type: 'text', required: true },
  { slug: 'cnpj_cpf', name: 'CNPJ/CPF', type: 'text' },
  { slug: 'email', name: 'Email', type: 'email' },
  { slug: 'rntrc', name: 'RNTRC', type: 'text' },
];

const categoriaDocumentoFields: FieldConfig[] = [
  { slug: 'name', name: 'Nome', type: 'text', required: true },
  { slug: 'code', name: 'Codigo', type: 'text', required: true },
];

// Pages de Sinistros - Entities de Suporte
const sinistrosSupportPages: PageDefinition[] = [
  // Corretores
  {
    title: 'Corretores',
    slug: 'corretores',
    description: 'Lista de corretores',
    icon: 'user-tie',
    contentGenerator: () =>
      generateListPage({
        title: 'Corretores',
        entitySlug: 'corretor',
        columns: ['email', 'phone', 'city', 'state'],
        searchFields: ['email', 'city'],
        createLink: '/corretores-novo',
      }),
  },
  {
    title: 'Novo Corretor',
    slug: 'corretores-novo',
    description: 'Cadastrar novo corretor',
    icon: 'user-plus',
    contentGenerator: () =>
      generateFormPage({
        title: 'Novo Corretor',
        entitySlug: 'corretor',
        fields: corretorFields,
        returnPath: '/corretores',
      }),
  },
  {
    title: 'Editar Corretor',
    slug: 'corretores-editar',
    description: 'Editar corretor',
    icon: 'user-cog',
    contentGenerator: () =>
      generateFormPage({
        title: 'Editar Corretor',
        entitySlug: 'corretor',
        fields: corretorFields,
        isEdit: true,
        returnPath: '/corretores',
      }),
  },

  // Seguradoras
  {
    title: 'Seguradoras',
    slug: 'seguradoras',
    description: 'Lista de seguradoras',
    icon: 'shield',
    contentGenerator: () =>
      generateListPage({
        title: 'Seguradoras',
        entitySlug: 'seguradora',
        columns: ['company_name', 'cnpj', 'phone', 'email'],
        searchFields: ['company_name', 'cnpj'],
        createLink: '/seguradoras-nova',
      }),
  },
  {
    title: 'Nova Seguradora',
    slug: 'seguradoras-nova',
    description: 'Cadastrar nova seguradora',
    icon: 'shield-plus',
    contentGenerator: () =>
      generateFormPage({
        title: 'Nova Seguradora',
        entitySlug: 'seguradora',
        fields: seguradoraFields,
        returnPath: '/seguradoras',
      }),
  },
  {
    title: 'Editar Seguradora',
    slug: 'seguradoras-editar',
    description: 'Editar seguradora',
    icon: 'shield',
    contentGenerator: () =>
      generateFormPage({
        title: 'Editar Seguradora',
        entitySlug: 'seguradora',
        fields: seguradoraFields,
        isEdit: true,
        returnPath: '/seguradoras',
      }),
  },

  // Segurados
  {
    title: 'Segurados',
    slug: 'segurados',
    description: 'Lista de segurados',
    icon: 'building',
    contentGenerator: () =>
      generateListPage({
        title: 'Segurados',
        entitySlug: 'segurado',
        columns: ['company_name', 'fantasy_name', 'cnpj', 'email'],
        searchFields: ['company_name', 'fantasy_name', 'cnpj'],
        createLink: '/segurados-novo',
      }),
  },
  {
    title: 'Novo Segurado',
    slug: 'segurados-novo',
    description: 'Cadastrar novo segurado',
    icon: 'building-plus',
    contentGenerator: () =>
      generateFormPage({
        title: 'Novo Segurado',
        entitySlug: 'segurado',
        fields: seguradoFields,
        returnPath: '/segurados',
      }),
  },
  {
    title: 'Editar Segurado',
    slug: 'segurados-editar',
    description: 'Editar segurado',
    icon: 'building',
    contentGenerator: () =>
      generateFormPage({
        title: 'Editar Segurado',
        entitySlug: 'segurado',
        fields: seguradoFields,
        isEdit: true,
        returnPath: '/segurados',
      }),
  },

  // Reguladoras
  {
    title: 'Reguladoras',
    slug: 'reguladoras',
    description: 'Lista de reguladoras',
    icon: 'clipboard-check',
    contentGenerator: () =>
      generateListPage({
        title: 'Reguladoras',
        entitySlug: 'reguladora',
        columns: ['name', 'cnpj', 'phone', 'email'],
        searchFields: ['name', 'cnpj'],
        createLink: '/reguladoras-nova',
      }),
  },
  {
    title: 'Nova Reguladora',
    slug: 'reguladoras-nova',
    description: 'Cadastrar nova reguladora',
    icon: 'clipboard-plus',
    contentGenerator: () =>
      generateFormPage({
        title: 'Nova Reguladora',
        entitySlug: 'reguladora',
        fields: reguladoraFields,
        returnPath: '/reguladoras',
      }),
  },
  {
    title: 'Editar Reguladora',
    slug: 'reguladoras-editar',
    description: 'Editar reguladora',
    icon: 'clipboard-check',
    contentGenerator: () =>
      generateFormPage({
        title: 'Editar Reguladora',
        entitySlug: 'reguladora',
        fields: reguladoraFields,
        isEdit: true,
        returnPath: '/reguladoras',
      }),
  },

  // Gerenciadoras de Risco
  {
    title: 'Gerenciadoras de Risco',
    slug: 'gerenciadoras-risco',
    description: 'Lista de gerenciadoras de risco',
    icon: 'alert-triangle',
    contentGenerator: () =>
      generateListPage({
        title: 'Gerenciadoras de Risco',
        entitySlug: 'gerenciadora-risco',
        columns: ['name', 'cnpj', 'phone', 'email'],
        searchFields: ['name', 'cnpj'],
        createLink: '/gerenciadoras-risco-nova',
      }),
  },
  {
    title: 'Nova Gerenciadora de Risco',
    slug: 'gerenciadoras-risco-nova',
    description: 'Cadastrar nova gerenciadora de risco',
    icon: 'alert-plus',
    contentGenerator: () =>
      generateFormPage({
        title: 'Nova Gerenciadora de Risco',
        entitySlug: 'gerenciadora-risco',
        fields: gerenciadoraRiscoFields,
        returnPath: '/gerenciadoras-risco',
      }),
  },
  {
    title: 'Editar Gerenciadora de Risco',
    slug: 'gerenciadoras-risco-editar',
    description: 'Editar gerenciadora de risco',
    icon: 'alert-triangle',
    contentGenerator: () =>
      generateFormPage({
        title: 'Editar Gerenciadora de Risco',
        entitySlug: 'gerenciadora-risco',
        fields: gerenciadoraRiscoFields,
        isEdit: true,
        returnPath: '/gerenciadoras-risco',
      }),
  },

  // Transportadoras
  {
    title: 'Transportadoras',
    slug: 'transportadoras',
    description: 'Lista de transportadoras',
    icon: 'truck',
    contentGenerator: () =>
      generateListPage({
        title: 'Transportadoras',
        entitySlug: 'transportadora',
        columns: ['company_name', 'cnpj_cpf', 'email', 'rntrc'],
        searchFields: ['company_name', 'cnpj_cpf'],
        createLink: '/transportadoras-nova',
      }),
  },
  {
    title: 'Nova Transportadora',
    slug: 'transportadoras-nova',
    description: 'Cadastrar nova transportadora',
    icon: 'truck-plus',
    contentGenerator: () =>
      generateFormPage({
        title: 'Nova Transportadora',
        entitySlug: 'transportadora',
        fields: transportadoraFields,
        returnPath: '/transportadoras',
      }),
  },
  {
    title: 'Editar Transportadora',
    slug: 'transportadoras-editar',
    description: 'Editar transportadora',
    icon: 'truck',
    contentGenerator: () =>
      generateFormPage({
        title: 'Editar Transportadora',
        entitySlug: 'transportadora',
        fields: transportadoraFields,
        isEdit: true,
        returnPath: '/transportadoras',
      }),
  },

  // Categorias de Documento
  {
    title: 'Categorias de Documento',
    slug: 'categorias-documento',
    description: 'Lista de categorias de documento',
    icon: 'folder',
    contentGenerator: () =>
      generateListPage({
        title: 'Categorias de Documento',
        entitySlug: 'categoria-documento',
        columns: ['name', 'code'],
        searchFields: ['name', 'code'],
        createLink: '/categorias-documento-nova',
      }),
  },
  {
    title: 'Nova Categoria de Documento',
    slug: 'categorias-documento-nova',
    description: 'Cadastrar nova categoria de documento',
    icon: 'folder-plus',
    contentGenerator: () =>
      generateFormPage({
        title: 'Nova Categoria de Documento',
        entitySlug: 'categoria-documento',
        fields: categoriaDocumentoFields,
        returnPath: '/categorias-documento',
      }),
  },
  {
    title: 'Editar Categoria de Documento',
    slug: 'categorias-documento-editar',
    description: 'Editar categoria de documento',
    icon: 'folder',
    contentGenerator: () =>
      generateFormPage({
        title: 'Editar Categoria de Documento',
        entitySlug: 'categoria-documento',
        fields: categoriaDocumentoFields,
        isEdit: true,
        returnPath: '/categorias-documento',
      }),
  },
];

// Pages principais de Sinistros
const sinistrosMainPages: PageDefinition[] = [
  // Lista de Sinistros
  {
    title: 'Sinistros',
    slug: 'sinistros',
    description: 'Lista de sinistros',
    icon: 'file-warning',
    contentGenerator: () =>
      generateListPage({
        title: 'Sinistros',
        entitySlug: 'sinistro',
        columns: ['insurance_claim_number', 'insured_name', 'event_date', 'cause_type', 'status'],
        searchFields: ['insurance_claim_number', 'insured_name', 'driver_name'],
        createLink: '/sinistros-novo',
      }),
  },
  // Novo Sinistro - Formulario simplificado
  {
    title: 'Novo Sinistro',
    slug: 'sinistros-novo',
    description: 'Cadastrar novo sinistro',
    icon: 'file-plus',
    contentGenerator: () => ({
      content: [
        {
          type: 'Section',
          props: { id: 'section-1', padding: 'medium' },
        },
        {
          type: 'Heading',
          props: { id: 'heading-1', text: 'Novo Sinistro', level: 'h1' },
        },
        {
          type: 'Spacer',
          props: { id: 'spacer-1', size: 'lg' },
        },
        {
          type: 'Tabs',
          props: {
            id: 'tabs-sinistro',
            variant: 'default',
            tabs: [
              { id: 'tab-geral', label: 'Dados Gerais' },
              { id: 'tab-evento', label: 'Evento' },
              { id: 'tab-veiculo', label: 'Veiculo/Motorista' },
              { id: 'tab-carga', label: 'Carga' },
              { id: 'tab-financeiro', label: 'Financeiro' },
            ],
          },
        },
        {
          type: 'Form',
          props: {
            id: 'sinistro-form',
            entitySlug: 'sinistro',
            mode: 'create',
            submitText: 'Criar Sinistro',
            cancelHref: '/sinistros',
            events: [
              {
                type: 'onSuccess',
                actions: [
                  { type: 'navigate', navigateTo: '/sinistros' },
                  { type: 'showToast', toastMessage: 'Sinistro criado com sucesso!', toastType: 'success' },
                ],
              },
            ],
          },
        },
      ],
      root: { props: { title: 'Novo Sinistro' } },
    }),
  },
  // Visualizar Sinistro
  {
    title: 'Ver Sinistro',
    slug: 'sinistros-ver',
    description: 'Visualizar sinistro',
    icon: 'file-text',
    contentGenerator: () =>
      generateViewPage({
        title: 'Detalhes do Sinistro',
        entitySlug: 'sinistro',
        fields: [
          { slug: 'insurance_claim_number', label: 'Numero Sinistro Seguradora' },
          { slug: 'regulator_claim_number', label: 'Numero Sinistro Reguladora' },
          { slug: 'insured_name', label: 'Segurado' },
          { slug: 'insurance_company_name', label: 'Seguradora' },
          { slug: 'event_date', label: 'Data Evento', type: 'date' },
          { slug: 'cause_type', label: 'Tipo Causa' },
          { slug: 'status', label: 'Status' },
          { slug: 'loss_estimation', label: 'Estimativa Perda', type: 'currency' },
          { slug: 'vehicle_plate', label: 'Placa Veiculo' },
          { slug: 'driver_name', label: 'Motorista' },
        ],
        editPath: '/sinistros-editar',
        returnPath: '/sinistros',
        relatedEntities: [
          {
            title: 'Follow-ups',
            entitySlug: 'sinistro-followup',
            relationField: 'sinistro_id',
            displayFields: ['datetime', 'actions', 'user_name'],
          },
          {
            title: 'Arquivos',
            entitySlug: 'sinistro-arquivo',
            relationField: 'sinistro_id',
            displayFields: ['datetime', 'originalname', 'category_id'],
          },
        ],
      }),
  },
  // Editar Sinistro
  {
    title: 'Editar Sinistro',
    slug: 'sinistros-editar',
    description: 'Editar sinistro',
    icon: 'file-edit',
    contentGenerator: () => ({
      content: [
        {
          type: 'Section',
          props: { id: 'section-1', padding: 'medium' },
        },
        {
          type: 'FlexRow',
          props: { id: 'header-row', justify: 'space-between', align: 'center' },
        },
        {
          type: 'Heading',
          props: { id: 'heading-1', text: 'Editar Sinistro', level: 'h1' },
        },
        {
          type: 'Button',
          props: { id: 'btn-back', text: 'Voltar', variant: 'outline', href: '/sinistros' },
        },
        {
          type: 'Spacer',
          props: { id: 'spacer-1', size: 'lg' },
        },
        {
          type: 'Tabs',
          props: {
            id: 'tabs-sinistro',
            variant: 'default',
            tabs: [
              { id: 'tab-geral', label: 'Dados Gerais' },
              { id: 'tab-evento', label: 'Evento' },
              { id: 'tab-veiculo', label: 'Veiculo/Motorista' },
              { id: 'tab-carga', label: 'Carga' },
              { id: 'tab-financeiro', label: 'Financeiro' },
            ],
          },
        },
        {
          type: 'Form',
          props: {
            id: 'sinistro-form',
            entitySlug: 'sinistro',
            mode: 'edit',
            submitText: 'Salvar',
            cancelHref: '/sinistros',
            events: [
              {
                type: 'onSuccess',
                actions: [
                  { type: 'navigate', navigateTo: '/sinistros' },
                  { type: 'showToast', toastMessage: 'Sinistro atualizado!', toastType: 'success' },
                ],
              },
            ],
          },
        },
      ],
      root: { props: { title: 'Editar Sinistro' } },
    }),
  },
];

// ============================================================================
// DEFINICOES DE PAGES - VEICULOS
// ============================================================================

const pecaVeiculoFields: FieldConfig[] = [
  { slug: 'area', name: 'Area', type: 'number' },
  { slug: 'name', name: 'Nome', type: 'text', required: true },
];

const tipoNcFields: FieldConfig[] = [{ slug: 'nctype', name: 'Tipo', type: 'text', required: true }];

const nivelNcFields: FieldConfig[] = [{ slug: 'level', name: 'Nivel', type: 'text', required: true }];

const quadranteFields: FieldConfig[] = [{ slug: 'option', name: 'Opcao', type: 'number', required: true }];

const medidaFields: FieldConfig[] = [{ slug: 'size', name: 'Tamanho', type: 'text', required: true }];

const localNcFields: FieldConfig[] = [{ slug: 'local', name: 'Local', type: 'text', required: true }];

// Pages de Veiculos - Entities de Suporte
const veiculosSupportPages: PageDefinition[] = [
  // Pecas de Veiculo
  {
    title: 'Pecas de Veiculo',
    slug: 'pecas-veiculo',
    description: 'Lista de pecas de veiculo',
    icon: 'cog',
    contentGenerator: () =>
      generateListPage({
        title: 'Pecas de Veiculo',
        entitySlug: 'peca-veiculo',
        columns: ['area', 'name'],
        searchFields: ['name'],
        createLink: '/pecas-veiculo-nova',
      }),
  },
  {
    title: 'Nova Peca de Veiculo',
    slug: 'pecas-veiculo-nova',
    description: 'Cadastrar nova peca de veiculo',
    icon: 'cog-plus',
    contentGenerator: () =>
      generateFormPage({
        title: 'Nova Peca de Veiculo',
        entitySlug: 'peca-veiculo',
        fields: pecaVeiculoFields,
        returnPath: '/pecas-veiculo',
      }),
  },
  {
    title: 'Editar Peca de Veiculo',
    slug: 'pecas-veiculo-editar',
    description: 'Editar peca de veiculo',
    icon: 'cog',
    contentGenerator: () =>
      generateFormPage({
        title: 'Editar Peca de Veiculo',
        entitySlug: 'peca-veiculo',
        fields: pecaVeiculoFields,
        isEdit: true,
        returnPath: '/pecas-veiculo',
      }),
  },

  // Tipos de Nao Conformidade
  {
    title: 'Tipos de Nao Conformidade',
    slug: 'tipos-nao-conformidade',
    description: 'Lista de tipos de nao conformidade',
    icon: 'alert-circle',
    contentGenerator: () =>
      generateListPage({
        title: 'Tipos de Nao Conformidade',
        entitySlug: 'tipo-nao-conformidade',
        columns: ['nctype'],
        searchFields: ['nctype'],
        createLink: '/tipos-nao-conformidade-novo',
      }),
  },
  {
    title: 'Novo Tipo de Nao Conformidade',
    slug: 'tipos-nao-conformidade-novo',
    description: 'Cadastrar novo tipo de nao conformidade',
    icon: 'alert-plus',
    contentGenerator: () =>
      generateFormPage({
        title: 'Novo Tipo de Nao Conformidade',
        entitySlug: 'tipo-nao-conformidade',
        fields: tipoNcFields,
        returnPath: '/tipos-nao-conformidade',
      }),
  },
  {
    title: 'Editar Tipo de Nao Conformidade',
    slug: 'tipos-nao-conformidade-editar',
    description: 'Editar tipo de nao conformidade',
    icon: 'alert-circle',
    contentGenerator: () =>
      generateFormPage({
        title: 'Editar Tipo de Nao Conformidade',
        entitySlug: 'tipo-nao-conformidade',
        fields: tipoNcFields,
        isEdit: true,
        returnPath: '/tipos-nao-conformidade',
      }),
  },

  // Niveis de Nao Conformidade
  {
    title: 'Niveis de Nao Conformidade',
    slug: 'niveis-nao-conformidade',
    description: 'Lista de niveis de nao conformidade',
    icon: 'thermometer',
    contentGenerator: () =>
      generateListPage({
        title: 'Niveis de Nao Conformidade',
        entitySlug: 'nivel-nao-conformidade',
        columns: ['level'],
        searchFields: ['level'],
        createLink: '/niveis-nao-conformidade-novo',
      }),
  },
  {
    title: 'Novo Nivel de Nao Conformidade',
    slug: 'niveis-nao-conformidade-novo',
    description: 'Cadastrar novo nivel de nao conformidade',
    icon: 'thermometer-plus',
    contentGenerator: () =>
      generateFormPage({
        title: 'Novo Nivel de Nao Conformidade',
        entitySlug: 'nivel-nao-conformidade',
        fields: nivelNcFields,
        returnPath: '/niveis-nao-conformidade',
      }),
  },
  {
    title: 'Editar Nivel de Nao Conformidade',
    slug: 'niveis-nao-conformidade-editar',
    description: 'Editar nivel de nao conformidade',
    icon: 'thermometer',
    contentGenerator: () =>
      generateFormPage({
        title: 'Editar Nivel de Nao Conformidade',
        entitySlug: 'nivel-nao-conformidade',
        fields: nivelNcFields,
        isEdit: true,
        returnPath: '/niveis-nao-conformidade',
      }),
  },

  // Quadrantes
  {
    title: 'Quadrantes',
    slug: 'quadrantes',
    description: 'Lista de quadrantes',
    icon: 'grid',
    contentGenerator: () =>
      generateListPage({
        title: 'Quadrantes',
        entitySlug: 'quadrante',
        columns: ['option'],
        createLink: '/quadrantes-novo',
      }),
  },
  {
    title: 'Novo Quadrante',
    slug: 'quadrantes-novo',
    description: 'Cadastrar novo quadrante',
    icon: 'grid-plus',
    contentGenerator: () =>
      generateFormPage({
        title: 'Novo Quadrante',
        entitySlug: 'quadrante',
        fields: quadranteFields,
        returnPath: '/quadrantes',
      }),
  },
  {
    title: 'Editar Quadrante',
    slug: 'quadrantes-editar',
    description: 'Editar quadrante',
    icon: 'grid',
    contentGenerator: () =>
      generateFormPage({
        title: 'Editar Quadrante',
        entitySlug: 'quadrante',
        fields: quadranteFields,
        isEdit: true,
        returnPath: '/quadrantes',
      }),
  },

  // Medidas
  {
    title: 'Medidas',
    slug: 'medidas',
    description: 'Lista de medidas',
    icon: 'ruler',
    contentGenerator: () =>
      generateListPage({
        title: 'Medidas',
        entitySlug: 'medida',
        columns: ['size'],
        searchFields: ['size'],
        createLink: '/medidas-nova',
      }),
  },
  {
    title: 'Nova Medida',
    slug: 'medidas-nova',
    description: 'Cadastrar nova medida',
    icon: 'ruler-plus',
    contentGenerator: () =>
      generateFormPage({
        title: 'Nova Medida',
        entitySlug: 'medida',
        fields: medidaFields,
        returnPath: '/medidas',
      }),
  },
  {
    title: 'Editar Medida',
    slug: 'medidas-editar',
    description: 'Editar medida',
    icon: 'ruler',
    contentGenerator: () =>
      generateFormPage({
        title: 'Editar Medida',
        entitySlug: 'medida',
        fields: medidaFields,
        isEdit: true,
        returnPath: '/medidas',
      }),
  },

  // Locais de Nao Conformidade
  {
    title: 'Locais de Nao Conformidade',
    slug: 'locais-nao-conformidade',
    description: 'Lista de locais de nao conformidade',
    icon: 'map-pin',
    contentGenerator: () =>
      generateListPage({
        title: 'Locais de Nao Conformidade',
        entitySlug: 'local-nao-conformidade',
        columns: ['local'],
        searchFields: ['local'],
        createLink: '/locais-nao-conformidade-novo',
      }),
  },
  {
    title: 'Novo Local de Nao Conformidade',
    slug: 'locais-nao-conformidade-novo',
    description: 'Cadastrar novo local de nao conformidade',
    icon: 'map-pin-plus',
    contentGenerator: () =>
      generateFormPage({
        title: 'Novo Local de Nao Conformidade',
        entitySlug: 'local-nao-conformidade',
        fields: localNcFields,
        returnPath: '/locais-nao-conformidade',
      }),
  },
  {
    title: 'Editar Local de Nao Conformidade',
    slug: 'locais-nao-conformidade-editar',
    description: 'Editar local de nao conformidade',
    icon: 'map-pin',
    contentGenerator: () =>
      generateFormPage({
        title: 'Editar Local de Nao Conformidade',
        entitySlug: 'local-nao-conformidade',
        fields: localNcFields,
        isEdit: true,
        returnPath: '/locais-nao-conformidade',
      }),
  },
];

// Pages principais de Veiculos
const veiculosMainPages: PageDefinition[] = [
  // Lista de Veiculos
  {
    title: 'Veiculos',
    slug: 'veiculos',
    description: 'Lista de veiculos',
    icon: 'car',
    contentGenerator: () =>
      generateListPage({
        title: 'Veiculos',
        entitySlug: 'veiculo',
        columns: ['chassis', 'brand', 'model', 'ship', 'travel', 'status', 'done'],
        searchFields: ['chassis', 'brand', 'model', 'ship'],
        createLink: '/veiculos-novo',
      }),
  },
  // Novo Veiculo
  {
    title: 'Novo Veiculo',
    slug: 'veiculos-novo',
    description: 'Cadastrar novo veiculo',
    icon: 'car-plus',
    contentGenerator: () =>
      generateFormPage({
        title: 'Novo Veiculo',
        entitySlug: 'veiculo',
        fields: [
          { slug: 'chassis', name: 'Chassi', type: 'text', required: true },
          { slug: 'brand', name: 'Marca', type: 'text' },
          { slug: 'model', name: 'Modelo', type: 'text' },
          { slug: 'type', name: 'Tipo', type: 'text' },
          { slug: 'ship', name: 'Navio', type: 'text' },
          { slug: 'travel', name: 'Viagem', type: 'text' },
          { slug: 'location', name: 'Localizacao', type: 'text' },
          {
            slug: 'status',
            name: 'Status',
            type: 'select',
            options: [
              { value: 'aguardando', label: 'Aguardando' },
              { value: 'em_inspecao', label: 'Em Inspecao' },
              { value: 'aprovado', label: 'Aprovado' },
              { value: 'reprovado', label: 'Reprovado' },
              { value: 'liberado', label: 'Liberado' },
            ],
          },
          {
            slug: 'situation',
            name: 'Situacao',
            type: 'select',
            options: [
              { value: 'novo', label: 'Novo' },
              { value: 'usado', label: 'Usado' },
              { value: 'danificado', label: 'Danificado' },
            ],
          },
          {
            slug: 'done',
            name: 'Concluido',
            type: 'select',
            options: [
              { value: 'yes', label: 'Sim' },
              { value: 'no', label: 'Nao' },
            ],
          },
          { slug: 'observations', name: 'Observacoes', type: 'textarea' },
        ],
        returnPath: '/veiculos',
      }),
  },
  // Visualizar Veiculo
  {
    title: 'Ver Veiculo',
    slug: 'veiculos-ver',
    description: 'Visualizar veiculo',
    icon: 'car',
    contentGenerator: () =>
      generateViewPage({
        title: 'Detalhes do Veiculo',
        entitySlug: 'veiculo',
        fields: [
          { slug: 'chassis', label: 'Chassi' },
          { slug: 'brand', label: 'Marca' },
          { slug: 'model', label: 'Modelo' },
          { slug: 'type', label: 'Tipo' },
          { slug: 'ship', label: 'Navio' },
          { slug: 'travel', label: 'Viagem' },
          { slug: 'location', label: 'Localizacao' },
          { slug: 'status', label: 'Status' },
          { slug: 'situation', label: 'Situacao' },
          { slug: 'done', label: 'Concluido' },
          { slug: 'observations', label: 'Observacoes' },
        ],
        editPath: '/veiculos-editar',
        returnPath: '/veiculos',
        relatedEntities: [
          {
            title: 'Nao Conformidades',
            entitySlug: 'nao-conformidade',
            relationField: 'veiculo_id',
            displayFields: ['peca_veiculo_id', 'tipo_id', 'nivel_id', 'description'],
          },
        ],
      }),
  },
  // Editar Veiculo
  {
    title: 'Editar Veiculo',
    slug: 'veiculos-editar',
    description: 'Editar veiculo',
    icon: 'car-cog',
    contentGenerator: () =>
      generateFormPage({
        title: 'Editar Veiculo',
        entitySlug: 'veiculo',
        fields: [
          { slug: 'chassis', name: 'Chassi', type: 'text', required: true },
          { slug: 'brand', name: 'Marca', type: 'text' },
          { slug: 'model', name: 'Modelo', type: 'text' },
          { slug: 'type', name: 'Tipo', type: 'text' },
          { slug: 'ship', name: 'Navio', type: 'text' },
          { slug: 'travel', name: 'Viagem', type: 'text' },
          { slug: 'location', name: 'Localizacao', type: 'text' },
          {
            slug: 'status',
            name: 'Status',
            type: 'select',
            options: [
              { value: 'aguardando', label: 'Aguardando' },
              { value: 'em_inspecao', label: 'Em Inspecao' },
              { value: 'aprovado', label: 'Aprovado' },
              { value: 'reprovado', label: 'Reprovado' },
              { value: 'liberado', label: 'Liberado' },
            ],
          },
          {
            slug: 'situation',
            name: 'Situacao',
            type: 'select',
            options: [
              { value: 'novo', label: 'Novo' },
              { value: 'usado', label: 'Usado' },
              { value: 'danificado', label: 'Danificado' },
            ],
          },
          {
            slug: 'done',
            name: 'Concluido',
            type: 'select',
            options: [
              { value: 'yes', label: 'Sim' },
              { value: 'no', label: 'Nao' },
            ],
          },
          { slug: 'observations', name: 'Observacoes', type: 'textarea' },
        ],
        isEdit: true,
        returnPath: '/veiculos',
      }),
  },
  // Nao Conformidades do Veiculo
  {
    title: 'Nao Conformidades',
    slug: 'veiculos-nao-conformidades',
    description: 'Lista de nao conformidades do veiculo',
    icon: 'x-circle',
    contentGenerator: () =>
      generateListPage({
        title: 'Nao Conformidades',
        entitySlug: 'nao-conformidade',
        columns: ['veiculo_id', 'peca_veiculo_id', 'tipo_id', 'nivel_id'],
        createLink: '/veiculos-nao-conformidade-nova',
      }),
  },
  // Nova Nao Conformidade
  {
    title: 'Nova Nao Conformidade',
    slug: 'veiculos-nao-conformidade-nova',
    description: 'Cadastrar nova nao conformidade',
    icon: 'x-circle-plus',
    contentGenerator: () =>
      generateFormPage({
        title: 'Nova Nao Conformidade',
        entitySlug: 'nao-conformidade',
        fields: [
          { slug: 'veiculo_id', name: 'Veiculo', type: 'relation', required: true, relationEntitySlug: 'veiculo' },
          { slug: 'peca_veiculo_id', name: 'Peca', type: 'relation', relationEntitySlug: 'peca-veiculo' },
          { slug: 'tipo_id', name: 'Tipo', type: 'relation', relationEntitySlug: 'tipo-nao-conformidade' },
          { slug: 'nivel_id', name: 'Nivel', type: 'relation', relationEntitySlug: 'nivel-nao-conformidade' },
          { slug: 'quadrante_id', name: 'Quadrante', type: 'relation', relationEntitySlug: 'quadrante' },
          { slug: 'medida_id', name: 'Medida', type: 'relation', relationEntitySlug: 'medida' },
          { slug: 'local_id', name: 'Local', type: 'relation', relationEntitySlug: 'local-nao-conformidade' },
          { slug: 'description', name: 'Descricao', type: 'textarea' },
        ],
        returnPath: '/veiculos-nao-conformidades',
      }),
  },
  // Editar Nao Conformidade
  {
    title: 'Editar Nao Conformidade',
    slug: 'veiculos-nao-conformidade-editar',
    description: 'Editar nao conformidade',
    icon: 'x-circle',
    contentGenerator: () =>
      generateFormPage({
        title: 'Editar Nao Conformidade',
        entitySlug: 'nao-conformidade',
        fields: [
          { slug: 'veiculo_id', name: 'Veiculo', type: 'relation', required: true, relationEntitySlug: 'veiculo' },
          { slug: 'peca_veiculo_id', name: 'Peca', type: 'relation', relationEntitySlug: 'peca-veiculo' },
          { slug: 'tipo_id', name: 'Tipo', type: 'relation', relationEntitySlug: 'tipo-nao-conformidade' },
          { slug: 'nivel_id', name: 'Nivel', type: 'relation', relationEntitySlug: 'nivel-nao-conformidade' },
          { slug: 'quadrante_id', name: 'Quadrante', type: 'relation', relationEntitySlug: 'quadrante' },
          { slug: 'medida_id', name: 'Medida', type: 'relation', relationEntitySlug: 'medida' },
          { slug: 'local_id', name: 'Local', type: 'relation', relationEntitySlug: 'local-nao-conformidade' },
          { slug: 'description', name: 'Descricao', type: 'textarea' },
        ],
        isEdit: true,
        returnPath: '/veiculos-nao-conformidades',
      }),
  },
];

// ============================================================================
// FUNCAO PRINCIPAL DE SEED
// ============================================================================

export async function seedPages(tenantId: string) {
  console.log('\n=== Iniciando seed de Pages ===\n');

  const allPages = [
    ...sinistrosSupportPages,
    ...sinistrosMainPages,
    ...veiculosSupportPages,
    ...veiculosMainPages,
  ];

  console.log(`Criando ${allPages.length} pages...`);

  for (const pageDef of allPages) {
    await prisma.page.upsert({
      where: {
        tenantId_slug: {
          tenantId,
          slug: pageDef.slug,
        },
      },
      update: {},
      create: {
        tenantId,
        title: pageDef.title,
        slug: pageDef.slug,
        description: pageDef.description,
        icon: pageDef.icon,
        content: pageDef.contentGenerator(),
        isPublished: true,
        publishedAt: new Date(),
        permissions: [],
      },
    });
    console.log(`  - ${pageDef.title} (/${pageDef.slug}) criada`);
  }

  console.log(`\n=== Seed de Pages concluido (${allPages.length} pages) ===\n`);

  return allPages.length;
}

// ============================================================================
// EXECUCAO STANDALONE
// ============================================================================

async function main() {
  // Buscar tenant demo
  const demoTenant = await prisma.tenant.findUnique({
    where: { slug: 'demo' },
  });

  if (!demoTenant) {
    console.error('Tenant "demo" nao encontrado. Execute o seed principal primeiro.');
    process.exit(1);
  }

  await seedPages(demoTenant.id);
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
