import type { EntityField } from '@/types';

export interface AutomationTemplate {
  name: string;
  description?: string;
  trigger: string;
  triggerConfig?: Record<string, unknown>;
  conditions?: Array<{ field: string; operator: string; value: unknown }>;
  actions: Array<{
    order: number;
    type: string;
    config: Record<string, unknown>;
  }>;
}

export interface EntityTemplate {
  id: string;
  name: string;
  namePlural: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  templateCategory: string;
  fields: EntityField[];
  automations?: AutomationTemplate[];
}

export const templateCategories = [
  { id: 'CRM', label: 'CRM', icon: 'Target', color: '#10b981' },
  { id: 'Suporte', label: 'Suporte', icon: 'TicketCheck', color: '#f59e0b' },
  { id: 'Projetos', label: 'Projetos', icon: 'FolderKanban', color: '#06b6d4' },
  {
    id: 'Operacoes',
    label: 'Operacoes',
    icon: 'Wrench',
    color: '#f97316',
  },
  { id: 'Estoque', label: 'Estoque', icon: 'Package', color: '#a855f7' },
  { id: 'RH', label: 'RH', icon: 'UserCheck', color: '#ec4899' },
];

export const entityTemplates: EntityTemplate[] = [
  // ─────────────────────────────────────────────
  // 1. Leads
  // ─────────────────────────────────────────────
  {
    id: 'leads',
    name: 'Lead',
    namePlural: 'Leads',
    description:
      'Gerencie seus leads e oportunidades de negocio desde a captacao ate a qualificacao.',
    icon: 'Target',
    color: '#10b981',
    category: 'CRM',
    templateCategory: 'CRM',
    fields: [
      {
        slug: 'nome',
        name: 'nome',
        label: 'Nome',
        type: 'text',
        required: true,
      },
      {
        slug: 'email',
        name: 'email',
        label: 'E-mail',
        type: 'email',
      },
      {
        slug: 'telefone',
        name: 'telefone',
        label: 'Telefone',
        type: 'phone',
      },
      {
        slug: 'empresa',
        name: 'empresa',
        label: 'Empresa',
        type: 'text',
      },
      {
        slug: 'cargo',
        name: 'cargo',
        label: 'Cargo',
        type: 'text',
      },
      {
        slug: 'origem',
        name: 'origem',
        label: 'Origem',
        type: 'select',
        options: [
          { value: 'site', label: 'Site', color: '#3b82f6' },
          { value: 'indicacao', label: 'Indicacao', color: '#10b981' },
          { value: 'evento', label: 'Evento', color: '#8b5cf6' },
          { value: 'rede_social', label: 'Rede Social', color: '#f59e0b' },
          { value: 'outro', label: 'Outro', color: '#6b7280' },
        ],
      },
      {
        slug: 'status',
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'novo', label: 'Novo', color: '#3b82f6' },
          { value: 'contatado', label: 'Contatado', color: '#f59e0b' },
          { value: 'qualificado', label: 'Qualificado', color: '#10b981' },
          {
            value: 'desqualificado',
            label: 'Desqualificado',
            color: '#ef4444',
          },
        ],
      },
      {
        slug: 'valor_estimado',
        name: 'valor_estimado',
        label: 'Valor Estimado',
        type: 'currency',
        prefix: 'R$',
      },
      {
        slug: 'responsavel',
        name: 'responsavel',
        label: 'Responsavel',
        type: 'text',
      },
      {
        slug: 'notas',
        name: 'notas',
        label: 'Notas',
        type: 'richtext',
        gridColSpan: 2,
      },
      {
        slug: 'data_contato',
        name: 'data_contato',
        label: 'Data de Contato',
        type: 'date',
      },
    ],
    automations: [
      {
        name: 'Notificar novo lead',
        description: 'Envia notificacao quando um novo lead e criado.',
        trigger: 'ON_CREATE',
        actions: [
          {
            order: 1,
            type: 'notify_user',
            config: {
              title: 'Novo Lead',
              message: 'Um novo lead foi cadastrado: {{nome}}',
            },
          },
        ],
      },
      {
        name: 'Notificar lead qualificado',
        description:
          'Envia notificacao quando o status do lead muda para qualificado.',
        trigger: 'ON_STATUS_CHANGE',
        triggerConfig: { field: 'status' },
        conditions: [
          { field: 'status', operator: 'equals', value: 'qualificado' },
        ],
        actions: [
          {
            order: 1,
            type: 'notify_user',
            config: {
              title: 'Lead Qualificado',
              message: 'O lead {{nome}} foi qualificado!',
            },
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 2. Contatos
  // ─────────────────────────────────────────────
  {
    id: 'contatos',
    name: 'Contato',
    namePlural: 'Contatos',
    description:
      'Cadastro completo de contatos com informacoes pessoais, profissionais e endereco.',
    icon: 'Users',
    color: '#3b82f6',
    category: 'CRM',
    templateCategory: 'CRM',
    fields: [
      {
        slug: 'nome',
        name: 'nome',
        label: 'Nome',
        type: 'text',
        required: true,
      },
      {
        slug: 'email',
        name: 'email',
        label: 'E-mail',
        type: 'email',
      },
      {
        slug: 'telefone',
        name: 'telefone',
        label: 'Telefone',
        type: 'phone',
      },
      {
        slug: 'celular',
        name: 'celular',
        label: 'Celular',
        type: 'phone',
      },
      {
        slug: 'empresa',
        name: 'empresa',
        label: 'Empresa',
        type: 'text',
      },
      {
        slug: 'cargo',
        name: 'cargo',
        label: 'Cargo',
        type: 'text',
      },
      {
        slug: 'endereco',
        name: 'endereco',
        label: 'Endereco',
        type: 'map',
        mapMode: 'address',
        gridColSpan: 2,
      },
      {
        slug: 'cpf',
        name: 'cpf',
        label: 'CPF',
        type: 'cpf',
      },
      {
        slug: 'cnpj',
        name: 'cnpj',
        label: 'CNPJ',
        type: 'cnpj',
      },
      {
        slug: 'data_nascimento',
        name: 'data_nascimento',
        label: 'Data de Nascimento',
        type: 'date',
      },
      {
        slug: 'tags',
        name: 'tags',
        label: 'Tags',
        type: 'multiselect',
        options: [
          { value: 'cliente', label: 'Cliente', color: '#10b981' },
          { value: 'fornecedor', label: 'Fornecedor', color: '#3b82f6' },
          { value: 'parceiro', label: 'Parceiro', color: '#8b5cf6' },
          { value: 'prospect', label: 'Prospect', color: '#f59e0b' },
        ],
      },
      {
        slug: 'responsavel',
        name: 'responsavel',
        label: 'Responsavel',
        type: 'text',
      },
      {
        slug: 'status',
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'ativo', label: 'Ativo', color: '#10b981' },
          { value: 'inativo', label: 'Inativo', color: '#6b7280' },
        ],
      },
      {
        slug: 'foto',
        name: 'foto',
        label: 'Foto',
        type: 'image',
      },
      {
        slug: 'site',
        name: 'site',
        label: 'Site',
        type: 'url',
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 3. Negocios
  // ─────────────────────────────────────────────
  {
    id: 'negocios',
    name: 'Negocio',
    namePlural: 'Negocios',
    description:
      'Acompanhe suas oportunidades de negocio pelo funil de vendas ate o fechamento.',
    icon: 'Briefcase',
    color: '#8b5cf6',
    category: 'CRM',
    templateCategory: 'CRM',
    fields: [
      {
        slug: 'titulo',
        name: 'titulo',
        label: 'Titulo',
        type: 'text',
        required: true,
      },
      {
        slug: 'contato',
        name: 'contato',
        label: 'Contato',
        type: 'relation',
        relatedEntitySlug: 'contatos',
        relatedDisplayField: 'nome',
      },
      {
        slug: 'valor',
        name: 'valor',
        label: 'Valor',
        type: 'currency',
        prefix: 'R$',
      },
      {
        slug: 'etapa',
        name: 'etapa',
        label: 'Etapa',
        type: 'select',
        options: [
          { value: 'prospeccao', label: 'Prospeccao', color: '#3b82f6' },
          { value: 'proposta', label: 'Proposta', color: '#f59e0b' },
          { value: 'negociacao', label: 'Negociacao', color: '#8b5cf6' },
          {
            value: 'fechado_ganho',
            label: 'Fechado Ganho',
            color: '#10b981',
          },
          {
            value: 'fechado_perdido',
            label: 'Fechado Perdido',
            color: '#ef4444',
          },
        ],
      },
      {
        slug: 'probabilidade',
        name: 'probabilidade',
        label: 'Probabilidade',
        type: 'percentage',
      },
      {
        slug: 'data_previsao',
        name: 'data_previsao',
        label: 'Data de Previsao',
        type: 'date',
      },
      {
        slug: 'responsavel',
        name: 'responsavel',
        label: 'Responsavel',
        type: 'text',
      },
      {
        slug: 'notas',
        name: 'notas',
        label: 'Notas',
        type: 'richtext',
        gridColSpan: 2,
      },
    ],
    automations: [
      {
        name: 'Notificar negocio ganho',
        description:
          'Envia notificacao quando o negocio e fechado como ganho.',
        trigger: 'ON_STATUS_CHANGE',
        triggerConfig: { field: 'etapa' },
        conditions: [
          { field: 'etapa', operator: 'equals', value: 'fechado_ganho' },
        ],
        actions: [
          {
            order: 1,
            type: 'notify_user',
            config: {
              title: 'Negocio Fechado!',
              message:
                'O negocio {{titulo}} foi fechado como ganho! Valor: {{valor}}',
            },
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 4. Tickets
  // ─────────────────────────────────────────────
  {
    id: 'tickets',
    name: 'Ticket',
    namePlural: 'Tickets',
    description:
      'Sistema de suporte para gerenciar solicitacoes, bugs e melhorias dos clientes.',
    icon: 'TicketCheck',
    color: '#f59e0b',
    category: 'Suporte',
    templateCategory: 'Suporte',
    fields: [
      {
        slug: 'titulo',
        name: 'titulo',
        label: 'Titulo',
        type: 'text',
        required: true,
      },
      {
        slug: 'descricao',
        name: 'descricao',
        label: 'Descricao',
        type: 'richtext',
        required: true,
        gridColSpan: 2,
      },
      {
        slug: 'categoria_ticket',
        name: 'categoria_ticket',
        label: 'Categoria',
        type: 'select',
        options: [
          { value: 'bug', label: 'Bug', color: '#ef4444' },
          { value: 'melhoria', label: 'Melhoria', color: '#3b82f6' },
          { value: 'duvida', label: 'Duvida', color: '#f59e0b' },
          { value: 'solicitacao', label: 'Solicitacao', color: '#8b5cf6' },
        ],
      },
      {
        slug: 'prioridade',
        name: 'prioridade',
        label: 'Prioridade',
        type: 'select',
        options: [
          { value: 'baixa', label: 'Baixa', color: '#10b981' },
          { value: 'media', label: 'Media', color: '#f59e0b' },
          { value: 'alta', label: 'Alta', color: '#f97316' },
          { value: 'critica', label: 'Critica', color: '#ef4444' },
        ],
      },
      {
        slug: 'status',
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'aberto', label: 'Aberto', color: '#3b82f6' },
          {
            value: 'em_andamento',
            label: 'Em Andamento',
            color: '#f59e0b',
          },
          { value: 'aguardando', label: 'Aguardando', color: '#8b5cf6' },
          { value: 'resolvido', label: 'Resolvido', color: '#10b981' },
          { value: 'fechado', label: 'Fechado', color: '#6b7280' },
        ],
      },
      {
        slug: 'responsavel',
        name: 'responsavel',
        label: 'Responsavel',
        type: 'text',
      },
      {
        slug: 'solicitante_email',
        name: 'solicitante_email',
        label: 'E-mail do Solicitante',
        type: 'email',
      },
      {
        slug: 'solicitante_telefone',
        name: 'solicitante_telefone',
        label: 'Telefone do Solicitante',
        type: 'phone',
      },
      {
        slug: 'data_limite',
        name: 'data_limite',
        label: 'Data Limite',
        type: 'date',
      },
      {
        slug: 'resolucao',
        name: 'resolucao',
        label: 'Resolucao',
        type: 'richtext',
        gridColSpan: 2,
      },
    ],
    automations: [
      {
        name: 'Notificar novo ticket',
        description: 'Envia notificacao quando um novo ticket e criado.',
        trigger: 'ON_CREATE',
        actions: [
          {
            order: 1,
            type: 'notify_user',
            config: {
              title: 'Novo Ticket',
              message: 'Um novo ticket foi aberto: {{titulo}}',
            },
          },
        ],
      },
      {
        name: 'Notificar ticket resolvido',
        description:
          'Envia notificacao quando o ticket e marcado como resolvido.',
        trigger: 'ON_STATUS_CHANGE',
        triggerConfig: { field: 'status' },
        conditions: [
          { field: 'status', operator: 'equals', value: 'resolvido' },
        ],
        actions: [
          {
            order: 1,
            type: 'notify_user',
            config: {
              title: 'Ticket Resolvido',
              message: 'O ticket {{titulo}} foi resolvido.',
            },
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 5. Projetos
  // ─────────────────────────────────────────────
  {
    id: 'projetos',
    name: 'Projeto',
    namePlural: 'Projetos',
    description:
      'Gerencie projetos com acompanhamento de progresso, prazos e orcamento.',
    icon: 'FolderKanban',
    color: '#06b6d4',
    category: 'Projetos',
    templateCategory: 'Projetos',
    fields: [
      {
        slug: 'nome',
        name: 'nome',
        label: 'Nome',
        type: 'text',
        required: true,
      },
      {
        slug: 'descricao',
        name: 'descricao',
        label: 'Descricao',
        type: 'richtext',
        gridColSpan: 2,
      },
      {
        slug: 'cliente',
        name: 'cliente',
        label: 'Cliente',
        type: 'relation',
        relatedEntitySlug: 'contatos',
        relatedDisplayField: 'nome',
      },
      {
        slug: 'data_inicio',
        name: 'data_inicio',
        label: 'Data de Inicio',
        type: 'date',
      },
      {
        slug: 'data_fim',
        name: 'data_fim',
        label: 'Data de Fim',
        type: 'date',
      },
      {
        slug: 'status',
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'planejamento', label: 'Planejamento', color: '#3b82f6' },
          {
            value: 'em_andamento',
            label: 'Em Andamento',
            color: '#f59e0b',
          },
          { value: 'pausado', label: 'Pausado', color: '#8b5cf6' },
          { value: 'concluido', label: 'Concluido', color: '#10b981' },
          { value: 'cancelado', label: 'Cancelado', color: '#ef4444' },
        ],
      },
      {
        slug: 'progresso',
        name: 'progresso',
        label: 'Progresso',
        type: 'slider',
        min: 0,
        max: 100,
        step: 5,
      },
      {
        slug: 'responsavel',
        name: 'responsavel',
        label: 'Responsavel',
        type: 'text',
      },
      {
        slug: 'orcamento',
        name: 'orcamento',
        label: 'Orcamento',
        type: 'currency',
        prefix: 'R$',
      },
      {
        slug: 'notas',
        name: 'notas',
        label: 'Notas',
        type: 'richtext',
        gridColSpan: 2,
      },
    ],
    automations: [
      {
        name: 'Notificar projeto concluido',
        description:
          'Envia notificacao quando o projeto e marcado como concluido.',
        trigger: 'ON_STATUS_CHANGE',
        triggerConfig: { field: 'status' },
        conditions: [
          { field: 'status', operator: 'equals', value: 'concluido' },
        ],
        actions: [
          {
            order: 1,
            type: 'notify_user',
            config: {
              title: 'Projeto Concluido',
              message: 'O projeto {{nome}} foi concluido!',
            },
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 6. Tarefas
  // ─────────────────────────────────────────────
  {
    id: 'tarefas',
    name: 'Tarefa',
    namePlural: 'Tarefas',
    description:
      'Organize tarefas por projeto com prioridade, responsavel e prazos.',
    icon: 'CheckSquare',
    color: '#14b8a6',
    category: 'Projetos',
    templateCategory: 'Projetos',
    fields: [
      {
        slug: 'titulo',
        name: 'titulo',
        label: 'Titulo',
        type: 'text',
        required: true,
      },
      {
        slug: 'descricao',
        name: 'descricao',
        label: 'Descricao',
        type: 'richtext',
        gridColSpan: 2,
      },
      {
        slug: 'projeto',
        name: 'projeto',
        label: 'Projeto',
        type: 'relation',
        relatedEntitySlug: 'projetos',
        relatedDisplayField: 'nome',
      },
      {
        slug: 'responsavel',
        name: 'responsavel',
        label: 'Responsavel',
        type: 'text',
      },
      {
        slug: 'prioridade',
        name: 'prioridade',
        label: 'Prioridade',
        type: 'select',
        options: [
          { value: 'baixa', label: 'Baixa', color: '#10b981' },
          { value: 'media', label: 'Media', color: '#f59e0b' },
          { value: 'alta', label: 'Alta', color: '#ef4444' },
        ],
      },
      {
        slug: 'status',
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'pendente', label: 'Pendente', color: '#6b7280' },
          {
            value: 'em_andamento',
            label: 'Em Andamento',
            color: '#3b82f6',
          },
          { value: 'concluida', label: 'Concluida', color: '#10b981' },
          { value: 'cancelada', label: 'Cancelada', color: '#ef4444' },
        ],
      },
      {
        slug: 'data_limite',
        name: 'data_limite',
        label: 'Data Limite',
        type: 'date',
      },
      {
        slug: 'tempo_estimado',
        name: 'tempo_estimado',
        label: 'Tempo Estimado',
        type: 'number',
      },
      {
        slug: 'notas',
        name: 'notas',
        label: 'Notas',
        type: 'textarea',
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 7. Ordens de Servico
  // ─────────────────────────────────────────────
  {
    id: 'ordens_servico',
    name: 'Ordem de Servico',
    namePlural: 'Ordens de Servico',
    description:
      'Controle ordens de servico com acompanhamento de execucao, valores e localizacao.',
    icon: 'Wrench',
    color: '#f97316',
    category: 'Operacoes',
    templateCategory: 'Operacoes',
    fields: [
      {
        slug: 'numero',
        name: 'numero',
        label: 'Numero',
        type: 'text',
      },
      {
        slug: 'cliente',
        name: 'cliente',
        label: 'Cliente',
        type: 'relation',
        relatedEntitySlug: 'contatos',
        relatedDisplayField: 'nome',
      },
      {
        slug: 'descricao',
        name: 'descricao',
        label: 'Descricao',
        type: 'richtext',
        gridColSpan: 2,
      },
      {
        slug: 'tipo_servico',
        name: 'tipo_servico',
        label: 'Tipo de Servico',
        type: 'select',
        options: [
          { value: 'instalacao', label: 'Instalacao', color: '#3b82f6' },
          { value: 'manutencao', label: 'Manutencao', color: '#f59e0b' },
          { value: 'reparo', label: 'Reparo', color: '#ef4444' },
          { value: 'consultoria', label: 'Consultoria', color: '#8b5cf6' },
        ],
      },
      {
        slug: 'status',
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'aberta', label: 'Aberta', color: '#3b82f6' },
          { value: 'em_execucao', label: 'Em Execucao', color: '#f59e0b' },
          { value: 'concluida', label: 'Concluida', color: '#10b981' },
          { value: 'faturada', label: 'Faturada', color: '#8b5cf6' },
        ],
      },
      {
        slug: 'responsavel',
        name: 'responsavel',
        label: 'Responsavel',
        type: 'text',
      },
      {
        slug: 'data_abertura',
        name: 'data_abertura',
        label: 'Data de Abertura',
        type: 'date',
      },
      {
        slug: 'data_conclusao',
        name: 'data_conclusao',
        label: 'Data de Conclusao',
        type: 'date',
      },
      {
        slug: 'valor',
        name: 'valor',
        label: 'Valor',
        type: 'currency',
        prefix: 'R$',
      },
      {
        slug: 'local',
        name: 'local',
        label: 'Local',
        type: 'map',
        mapMode: 'address',
        gridColSpan: 2,
      },
      {
        slug: 'observacoes',
        name: 'observacoes',
        label: 'Observacoes',
        type: 'richtext',
        gridColSpan: 2,
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 8. Equipamentos
  // ─────────────────────────────────────────────
  {
    id: 'equipamentos',
    name: 'Equipamento',
    namePlural: 'Equipamentos',
    description:
      'Cadastro e controle de equipamentos com rastreamento de manutencao e localizacao.',
    icon: 'Cpu',
    color: '#64748b',
    category: 'Operacoes',
    templateCategory: 'Operacoes',
    fields: [
      {
        slug: 'nome',
        name: 'nome',
        label: 'Nome',
        type: 'text',
        required: true,
      },
      {
        slug: 'numero_serie',
        name: 'numero_serie',
        label: 'Numero de Serie',
        type: 'text',
        unique: true,
      },
      {
        slug: 'modelo',
        name: 'modelo',
        label: 'Modelo',
        type: 'text',
      },
      {
        slug: 'fabricante',
        name: 'fabricante',
        label: 'Fabricante',
        type: 'text',
      },
      {
        slug: 'localizacao',
        name: 'localizacao',
        label: 'Localizacao',
        type: 'map',
        mapMode: 'address',
        gridColSpan: 2,
      },
      {
        slug: 'status',
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'ativo', label: 'Ativo', color: '#10b981' },
          {
            value: 'em_manutencao',
            label: 'Em Manutencao',
            color: '#f59e0b',
          },
          { value: 'inativo', label: 'Inativo', color: '#6b7280' },
          { value: 'descartado', label: 'Descartado', color: '#ef4444' },
        ],
      },
      {
        slug: 'data_aquisicao',
        name: 'data_aquisicao',
        label: 'Data de Aquisicao',
        type: 'date',
      },
      {
        slug: 'proxima_manutencao',
        name: 'proxima_manutencao',
        label: 'Proxima Manutencao',
        type: 'date',
      },
      {
        slug: 'responsavel',
        name: 'responsavel',
        label: 'Responsavel',
        type: 'text',
      },
      {
        slug: 'notas',
        name: 'notas',
        label: 'Notas',
        type: 'richtext',
        gridColSpan: 2,
      },
      {
        slug: 'foto',
        name: 'foto',
        label: 'Foto',
        type: 'image',
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 9. Inspecoes
  // ─────────────────────────────────────────────
  {
    id: 'inspecoes',
    name: 'Inspecao',
    namePlural: 'Inspecoes',
    description:
      'Registre inspecoes de equipamentos com fotos, resultados e localizacao.',
    icon: 'ClipboardCheck',
    color: '#0ea5e9',
    category: 'Operacoes',
    templateCategory: 'Operacoes',
    fields: [
      {
        slug: 'titulo',
        name: 'titulo',
        label: 'Titulo',
        type: 'text',
        required: true,
      },
      {
        slug: 'equipamento',
        name: 'equipamento',
        label: 'Equipamento',
        type: 'relation',
        relatedEntitySlug: 'equipamentos',
        relatedDisplayField: 'nome',
      },
      {
        slug: 'inspetor',
        name: 'inspetor',
        label: 'Inspetor',
        type: 'text',
      },
      {
        slug: 'data_inspecao',
        name: 'data_inspecao',
        label: 'Data da Inspecao',
        type: 'date',
      },
      {
        slug: 'tipo',
        name: 'tipo',
        label: 'Tipo',
        type: 'select',
        options: [
          { value: 'preventiva', label: 'Preventiva', color: '#3b82f6' },
          { value: 'corretiva', label: 'Corretiva', color: '#f59e0b' },
          { value: 'auditoria', label: 'Auditoria', color: '#8b5cf6' },
        ],
      },
      {
        slug: 'resultado',
        name: 'resultado',
        label: 'Resultado',
        type: 'select',
        options: [
          { value: 'aprovado', label: 'Aprovado', color: '#10b981' },
          { value: 'reprovado', label: 'Reprovado', color: '#ef4444' },
          {
            value: 'com_ressalvas',
            label: 'Com Ressalvas',
            color: '#f59e0b',
          },
        ],
      },
      {
        slug: 'observacoes',
        name: 'observacoes',
        label: 'Observacoes',
        type: 'richtext',
        gridColSpan: 2,
      },
      {
        slug: 'fotos',
        name: 'fotos',
        label: 'Fotos',
        type: 'image',
        multiple: true,
        maxFiles: 10,
      },
      {
        slug: 'local',
        name: 'local',
        label: 'Local',
        type: 'map',
        mapMode: 'address',
        gridColSpan: 2,
      },
    ],
    automations: [
      {
        name: 'Notificar inspecao reprovada',
        description:
          'Envia notificacao quando uma inspecao e registrada como reprovada.',
        trigger: 'ON_CREATE',
        conditions: [
          { field: 'resultado', operator: 'equals', value: 'reprovado' },
        ],
        actions: [
          {
            order: 1,
            type: 'notify_user',
            config: {
              title: 'Inspecao Reprovada',
              message:
                'A inspecao {{titulo}} do equipamento {{equipamento}} foi reprovada!',
            },
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 10. Produtos
  // ─────────────────────────────────────────────
  {
    id: 'produtos',
    name: 'Produto',
    namePlural: 'Produtos',
    description:
      'Catalogo de produtos com controle de estoque, precos e informacoes de fornecedor.',
    icon: 'Package',
    color: '#a855f7',
    category: 'Estoque',
    templateCategory: 'Estoque',
    fields: [
      {
        slug: 'nome',
        name: 'nome',
        label: 'Nome',
        type: 'text',
        required: true,
      },
      {
        slug: 'sku',
        name: 'sku',
        label: 'SKU',
        type: 'text',
        unique: true,
      },
      {
        slug: 'descricao',
        name: 'descricao',
        label: 'Descricao',
        type: 'richtext',
        gridColSpan: 2,
      },
      {
        slug: 'categoria_produto',
        name: 'categoria_produto',
        label: 'Categoria',
        type: 'select',
        options: [
          {
            value: 'materia_prima',
            label: 'Materia Prima',
            color: '#f59e0b',
          },
          {
            value: 'produto_acabado',
            label: 'Produto Acabado',
            color: '#10b981',
          },
          { value: 'insumo', label: 'Insumo', color: '#3b82f6' },
          { value: 'peca', label: 'Peca', color: '#8b5cf6' },
        ],
      },
      {
        slug: 'preco_custo',
        name: 'preco_custo',
        label: 'Preco de Custo',
        type: 'currency',
        prefix: 'R$',
      },
      {
        slug: 'preco_venda',
        name: 'preco_venda',
        label: 'Preco de Venda',
        type: 'currency',
        prefix: 'R$',
      },
      {
        slug: 'estoque_atual',
        name: 'estoque_atual',
        label: 'Estoque Atual',
        type: 'number',
      },
      {
        slug: 'estoque_minimo',
        name: 'estoque_minimo',
        label: 'Estoque Minimo',
        type: 'number',
      },
      {
        slug: 'unidade',
        name: 'unidade',
        label: 'Unidade',
        type: 'select',
        options: [
          { value: 'un', label: 'Unidade', color: '#6b7280' },
          { value: 'kg', label: 'Quilograma', color: '#6b7280' },
          { value: 'lt', label: 'Litro', color: '#6b7280' },
          { value: 'm', label: 'Metro', color: '#6b7280' },
          { value: 'cx', label: 'Caixa', color: '#6b7280' },
        ],
      },
      {
        slug: 'fornecedor',
        name: 'fornecedor',
        label: 'Fornecedor',
        type: 'text',
      },
      {
        slug: 'fornecedor_email',
        name: 'fornecedor_email',
        label: 'E-mail do Fornecedor',
        type: 'email',
      },
      {
        slug: 'fornecedor_telefone',
        name: 'fornecedor_telefone',
        label: 'Telefone do Fornecedor',
        type: 'phone',
      },
      {
        slug: 'foto',
        name: 'foto',
        label: 'Foto',
        type: 'image',
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 11. Funcionarios
  // ─────────────────────────────────────────────
  {
    id: 'funcionarios',
    name: 'Funcionario',
    namePlural: 'Funcionarios',
    description:
      'Cadastro de funcionarios com informacoes pessoais, cargo, departamento e salario.',
    icon: 'UserCheck',
    color: '#ec4899',
    category: 'RH',
    templateCategory: 'RH',
    fields: [
      {
        slug: 'nome',
        name: 'nome',
        label: 'Nome',
        type: 'text',
        required: true,
      },
      {
        slug: 'email',
        name: 'email',
        label: 'E-mail',
        type: 'email',
        required: true,
      },
      {
        slug: 'telefone',
        name: 'telefone',
        label: 'Telefone',
        type: 'phone',
      },
      {
        slug: 'cargo',
        name: 'cargo',
        label: 'Cargo',
        type: 'text',
      },
      {
        slug: 'departamento',
        name: 'departamento',
        label: 'Departamento',
        type: 'select',
        options: [
          {
            value: 'administrativo',
            label: 'Administrativo',
            color: '#6b7280',
          },
          { value: 'comercial', label: 'Comercial', color: '#10b981' },
          { value: 'operacional', label: 'Operacional', color: '#f59e0b' },
          { value: 'ti', label: 'TI', color: '#3b82f6' },
          { value: 'financeiro', label: 'Financeiro', color: '#8b5cf6' },
          { value: 'rh', label: 'RH', color: '#ec4899' },
        ],
      },
      {
        slug: 'data_admissao',
        name: 'data_admissao',
        label: 'Data de Admissao',
        type: 'date',
      },
      {
        slug: 'salario',
        name: 'salario',
        label: 'Salario',
        type: 'currency',
        prefix: 'R$',
        hidden: true,
      },
      {
        slug: 'status',
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'ativo', label: 'Ativo', color: '#10b981' },
          { value: 'ferias', label: 'Ferias', color: '#3b82f6' },
          { value: 'afastado', label: 'Afastado', color: '#f59e0b' },
          { value: 'desligado', label: 'Desligado', color: '#ef4444' },
        ],
      },
      {
        slug: 'endereco',
        name: 'endereco',
        label: 'Endereco',
        type: 'map',
        mapMode: 'address',
        gridColSpan: 2,
      },
      {
        slug: 'cpf',
        name: 'cpf',
        label: 'CPF',
        type: 'cpf',
      },
      {
        slug: 'data_nascimento',
        name: 'data_nascimento',
        label: 'Data de Nascimento',
        type: 'date',
      },
      {
        slug: 'foto',
        name: 'foto',
        label: 'Foto',
        type: 'image',
      },
      {
        slug: 'linkedin',
        name: 'linkedin',
        label: 'LinkedIn',
        type: 'url',
      },
    ],
  },
];
