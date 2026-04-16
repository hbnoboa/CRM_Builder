# 🤖 Proposta: Bot Claude API (Haiku) para CRM Builder

## 📋 Requisitos

✅ **Escopo**: Todas entidades e módulos do sistema
✅ **Interface**: Chat global (todas páginas) com redirecionamento
✅ **Histórico**: Per-user com audit logging
✅ **Limites**: Token budget por usuário + tenant com display em tempo real
✅ **Segurança**: RBAC validation + confirmação + audit trail completo

---

## 🏗️ Arquitetura Proposta

### Visão Geral

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Floating Chat Widget (todas as páginas)               │ │
│  │  ├─ Streaming UI (SSE)                                 │ │
│  │  ├─ Token Counter Display                              │ │
│  │  ├─ Action Approval Dialog                             │ │
│  │  └─ Navigation Handler (redirect to action page)       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                    Backend (NestJS)                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ChatModule                                            │ │
│  │  ├─ ChatController (SSE streaming)                     │ │
│  │  ├─ ChatService (orchestration)                        │ │
│  │  ├─ ClaudeService (API integration)                    │ │
│  │  ├─ ToolRegistry (function definitions)                │ │
│  │  ├─ ToolExecutor (validation + execution)              │ │
│  │  ├─ TokenTracker (budget management)                   │ │
│  │  └─ ChatLogger (audit trail)                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Database:                                                   │
│  ├─ ChatConversation (histórico per-user)                   │
│  ├─ ChatMessage (mensagens)                                 │
│  ├─ ToolCallLog (audit de function calls)                   │
│  └─ TokenUsage (tracking de gastos)                         │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTPS
┌─────────────────────────────────────────────────────────────┐
│              Anthropic Claude API (Haiku)                    │
│              - Function calling / Tool use                   │
│              - Streaming responses                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Schema do Banco de Dados

```prisma
// apps/api/prisma/schema.prisma

model ChatConversation {
  id        String   @id @default(cuid())
  userId    String
  tenantId  String
  title     String?  // Auto-gerado pelo primeiro prompt
  context   Json?    // { currentPage, entitySlug, recordId }

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant   Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  messages ChatMessage[]

  @@index([userId, tenantId])
  @@index([tenantId])
}

model ChatMessage {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // 'user' | 'assistant' | 'system'
  content        String   @db.Text

  // Metadata da API
  usage          Json?    // { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens }
  toolCalls      Json?    // Array de tool calls executados

  createdAt      DateTime @default(now())

  conversation ChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
}

model ToolCallLog {
  id             String   @id @default(cuid())
  conversationId String?
  userId         String
  tenantId       String

  toolName       String   // Nome da function
  args           Json     // Argumentos da chamada
  result         Json?    // Resultado (se sucesso)
  error          String?  // Erro (se falhou)

  duration       Int      // Duração em ms
  success        Boolean  @default(true)

  timestamp      DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([userId, tenantId])
  @@index([tenantId])
  @@index([timestamp])
}

model TokenUsage {
  id        String   @id @default(cuid())
  userId    String
  tenantId  String
  month     String   // '2026-03'

  inputTokens          Int
  outputTokens         Int
  cacheCreationTokens  Int @default(0)
  cacheReadTokens      Int @default(0)
  totalTokens          Int

  timestamp DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([userId, month])
  @@index([tenantId, month])
}
```

---

## 🎯 Sistema de Tools (Function Calling)

### Tool Registry

```typescript
// apps/api/src/modules/chat/tool-registry.ts

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  permission: {
    type: 'module' | 'entity';
    resource: string;
    action: string;
  };
  destructive: boolean; // Requer confirmação?
}

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  // ═══════════════════════════════════════════════════════════
  // ENTITY DATA OPERATIONS
  // ═══════════════════════════════════════════════════════════
  list_entities: {
    name: 'list_entities',
    description: 'Lista todas as entidades disponíveis no tenant do usuário',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
    permission: {
      type: 'module',
      resource: 'data',
      action: 'canRead',
    },
    destructive: false,
  },

  search_records: {
    name: 'search_records',
    description: 'Busca registros em uma entidade com filtros, pesquisa textual e ordenação',
    input_schema: {
      type: 'object',
      properties: {
        entitySlug: {
          type: 'string',
          description: "Slug da entidade (ex: 'clientes', 'leads', 'produtos')",
        },
        search: {
          type: 'string',
          description: 'Termo de busca textual opcional (busca em campos configurados)',
        },
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              fieldSlug: { type: 'string' },
              operator: {
                type: 'string',
                enum: ['equals', 'contains', 'gt', 'lt', 'gte', 'lte', 'between', 'isEmpty', 'isNotEmpty'],
              },
              value: { type: 'string' },
              value2: { type: 'string', description: 'Para operador between' },
            },
          },
          description: 'Array de filtros opcionais',
        },
        sortBy: {
          type: 'string',
          description: 'Campo para ordenação (default: createdAt)',
        },
        sortOrder: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Ordem de ordenação (default: desc)',
        },
        limit: {
          type: 'number',
          description: 'Número máximo de registros (default: 20, max: 100)',
          maximum: 100,
        },
      },
      required: ['entitySlug'],
    },
    permission: {
      type: 'entity',
      resource: 'entitySlug',
      action: 'canRead',
    },
    destructive: false,
  },

  get_record: {
    name: 'get_record',
    description: 'Busca um registro específico por ID',
    input_schema: {
      type: 'object',
      properties: {
        entitySlug: { type: 'string' },
        recordId: { type: 'string', description: 'ID do registro' },
      },
      required: ['entitySlug', 'recordId'],
    },
    permission: {
      type: 'entity',
      resource: 'entitySlug',
      action: 'canRead',
    },
    destructive: false,
  },

  create_record: {
    name: 'create_record',
    description: 'Cria um novo registro em uma entidade',
    input_schema: {
      type: 'object',
      properties: {
        entitySlug: { type: 'string' },
        data: {
          type: 'object',
          description: 'Dados do registro no formato { campo: valor }',
        },
        parentRecordId: {
          type: 'string',
          description: 'ID do registro pai (para sub-entidades)',
        },
      },
      required: ['entitySlug', 'data'],
    },
    permission: {
      type: 'entity',
      resource: 'entitySlug',
      action: 'canCreate',
    },
    destructive: false,
  },

  update_record: {
    name: 'update_record',
    description: 'Atualiza um registro existente',
    input_schema: {
      type: 'object',
      properties: {
        entitySlug: { type: 'string' },
        recordId: { type: 'string' },
        data: {
          type: 'object',
          description: 'Apenas os campos a serem atualizados',
        },
      },
      required: ['entitySlug', 'recordId', 'data'],
    },
    permission: {
      type: 'entity',
      resource: 'entitySlug',
      action: 'canUpdate',
    },
    destructive: true, // Requer confirmação
  },

  delete_record: {
    name: 'delete_record',
    description: 'Exclui um registro (ATENÇÃO: ação irreversível)',
    input_schema: {
      type: 'object',
      properties: {
        entitySlug: { type: 'string' },
        recordId: { type: 'string' },
      },
      required: ['entitySlug', 'recordId'],
    },
    permission: {
      type: 'entity',
      resource: 'entitySlug',
      action: 'canDelete',
    },
    destructive: true, // Requer confirmação
  },

  // ═══════════════════════════════════════════════════════════
  // NAVIGATION & CONTEXT
  // ═══════════════════════════════════════════════════════════
  get_current_page_context: {
    name: 'get_current_page_context',
    description: 'Obtém contexto da página atual do usuário (URL, entidade ativa, filtros aplicados)',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
    permission: {
      type: 'module',
      resource: 'data',
      action: 'canRead',
    },
    destructive: false,
  },

  navigate_to_page: {
    name: 'navigate_to_page',
    description: 'Redireciona o usuário para uma página específica do sistema',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: "Caminho da página (ex: '/data/clientes', '/dashboard', '/users')",
        },
        openInNewTab: {
          type: 'boolean',
          description: 'Abrir em nova aba? (default: false)',
        },
      },
      required: ['path'],
    },
    permission: {
      type: 'module',
      resource: 'data',
      action: 'canRead',
    },
    destructive: false,
  },

  navigate_to_record: {
    name: 'navigate_to_record',
    description: 'Navega para a página de visualização ou edição de um registro específico',
    input_schema: {
      type: 'object',
      properties: {
        entitySlug: { type: 'string' },
        recordId: { type: 'string' },
        mode: {
          type: 'string',
          enum: ['view', 'edit'],
          description: 'Modo de visualização (default: view)',
        },
      },
      required: ['entitySlug', 'recordId'],
    },
    permission: {
      type: 'entity',
      resource: 'entitySlug',
      action: 'canRead',
    },
    destructive: false,
  },

  // ═══════════════════════════════════════════════════════════
  // USER & PERMISSIONS
  // ═══════════════════════════════════════════════════════════
  get_current_user_info: {
    name: 'get_current_user_info',
    description: 'Obtém informações do usuário logado (nome, email, cargo, permissões)',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
    permission: {
      type: 'module',
      resource: 'users',
      action: 'canRead',
    },
    destructive: false,
  },

  list_users: {
    name: 'list_users',
    description: 'Lista usuários do tenant (requer permissão)',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Buscar por nome ou email' },
        limit: { type: 'number', maximum: 100 },
      },
      required: [],
    },
    permission: {
      type: 'module',
      resource: 'users',
      action: 'canRead',
    },
    destructive: false,
  },

  check_permission: {
    name: 'check_permission',
    description: 'Verifica se o usuário tem uma permissão específica',
    input_schema: {
      type: 'object',
      properties: {
        resource: {
          type: 'string',
          description: 'Nome do módulo ou slug da entidade',
        },
        action: {
          type: 'string',
          enum: ['canRead', 'canCreate', 'canUpdate', 'canDelete'],
        },
      },
      required: ['resource', 'action'],
    },
    permission: {
      type: 'module',
      resource: 'users',
      action: 'canRead',
    },
    destructive: false,
  },

  // ═══════════════════════════════════════════════════════════
  // DASHBOARD & ANALYTICS
  // ═══════════════════════════════════════════════════════════
  get_dashboard_stats: {
    name: 'get_dashboard_stats',
    description: 'Busca estatísticas e métricas do dashboard',
    input_schema: {
      type: 'object',
      properties: {
        dashboardId: {
          type: 'string',
          description: 'ID do dashboard (opcional, usa padrão do usuário)',
        },
        dateRange: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date' },
            end: { type: 'string', format: 'date' },
          },
        },
      },
      required: [],
    },
    permission: {
      type: 'module',
      resource: 'dashboard',
      action: 'canRead',
    },
    destructive: false,
  },

  export_data: {
    name: 'export_data',
    description: 'Exporta dados de uma entidade em JSON ou XLSX',
    input_schema: {
      type: 'object',
      properties: {
        entitySlug: { type: 'string' },
        format: {
          type: 'string',
          enum: ['json', 'xlsx'],
          description: 'Formato do export (default: json)',
        },
        filters: {
          type: 'array',
          description: 'Filtros opcionais (mesmo formato de search_records)',
        },
      },
      required: ['entitySlug'],
    },
    permission: {
      type: 'entity',
      resource: 'entitySlug',
      action: 'canExport',
    },
    destructive: false,
  },

  // ═══════════════════════════════════════════════════════════
  // AUTOMATION
  // ═══════════════════════════════════════════════════════════
  trigger_webhook: {
    name: 'trigger_webhook',
    description: 'Dispara um webhook manualmente',
    input_schema: {
      type: 'object',
      properties: {
        webhookId: { type: 'string' },
        recordId: {
          type: 'string',
          description: 'ID do registro contexto (opcional)',
        },
      },
      required: ['webhookId'],
    },
    permission: {
      type: 'module',
      resource: 'webhooks',
      action: 'canExecute',
    },
    destructive: true,
  },

  execute_action_chain: {
    name: 'execute_action_chain',
    description: 'Executa uma action chain (cadeia de ações) manualmente',
    input_schema: {
      type: 'object',
      properties: {
        actionChainId: { type: 'string' },
        recordId: { type: 'string', description: 'ID do registro contexto (opcional)' },
      },
      required: ['actionChainId'],
    },
    permission: {
      type: 'module',
      resource: 'actionChains',
      action: 'canExecute',
    },
    destructive: true,
  },

  generate_pdf: {
    name: 'generate_pdf',
    description: 'Gera um PDF usando um template e dados de um registro',
    input_schema: {
      type: 'object',
      properties: {
        templateId: { type: 'string' },
        recordId: { type: 'string' },
      },
      required: ['templateId', 'recordId'],
    },
    permission: {
      type: 'module',
      resource: 'pdfTemplates',
      action: 'canGenerate',
    },
    destructive: false,
  },
};
```

---

## 🔐 Tool Executor (Validação + Execução)

```typescript
// apps/api/src/modules/chat/services/tool-executor.service.ts

import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DataService } from '@/modules/data/data.service';
import { EntityService } from '@/modules/entity/entity.service';
import { CustomRoleService } from '@/modules/custom-role/custom-role.service';
import { EntityDataQueryService } from '@/common/services/entity-data-query.service';
import { ChatLoggerService } from './chat-logger.service';
import { checkModulePermission } from '@/common/utils/check-module-permission';
import { CurrentUser } from '@/common/types/auth.types';
import { TOOL_REGISTRY, ToolDefinition } from '../tool-registry';

interface ToolExecutionResult {
  requiresConfirmation: boolean;
  toolName?: string;
  args?: any;
  message?: string;
  result?: any;
}

@Injectable()
export class ToolExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataService: DataService,
    private readonly entityService: EntityService,
    private readonly customRoleService: CustomRoleService,
    private readonly entityDataQueryService: EntityDataQueryService,
    private readonly chatLogger: ChatLoggerService,
  ) {}

  async executeTool(
    toolName: string,
    toolArgs: unknown,
    user: CurrentUser,
    conversationId: string,
  ): Promise<ToolExecutionResult> {
    // ═══════════════════════════════════════════════════════════
    // CAMADA 1: Validação de Schema
    // ═══════════════════════════════════════════════════════════
    const tool = TOOL_REGISTRY[toolName];
    if (!tool) {
      throw new BadRequestException(`Tool desconhecido: ${toolName}`);
    }

    // Validar argumentos contra schema (básico)
    const validatedArgs = this.validateToolArgs(tool, toolArgs);

    // ═══════════════════════════════════════════════════════════
    // CAMADA 2: Verificação de Permissão (RBAC)
    // ═══════════════════════════════════════════════════════════
    await this.checkToolPermission(tool, validatedArgs, user);

    // ═══════════════════════════════════════════════════════════
    // CAMADA 3: Aplicar Scope (Multi-tenancy + own/all)
    // ═══════════════════════════════════════════════════════════
    const scopedArgs = await this.applyScopeToArgs(toolName, validatedArgs, user);

    // ═══════════════════════════════════════════════════════════
    // CAMADA 4: Verificar Ações Destrutivas (confirmação)
    // ═══════════════════════════════════════════════════════════
    if (tool.destructive) {
      return {
        requiresConfirmation: true,
        toolName,
        args: scopedArgs,
        message: this.getConfirmationMessage(toolName, scopedArgs),
      };
    }

    // ═══════════════════════════════════════════════════════════
    // CAMADA 5: Execução com Audit Log
    // ═══════════════════════════════════════════════════════════
    const startTime = Date.now();
    let result: any;
    let success = true;
    let error: string | null = null;

    try {
      result = await this.executeToolInternal(toolName, scopedArgs, user);
    } catch (err) {
      success = false;
      error = err.message;
      throw err;
    } finally {
      // Log SEMPRE (sucesso ou falha)
      await this.chatLogger.logToolCall({
        conversationId,
        userId: user.id,
        tenantId: user.tenantId,
        toolName,
        args: scopedArgs,
        result: success ? result : null,
        error,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      });
    }

    return {
      requiresConfirmation: false,
      result,
    };
  }

  // ───────────────────────────────────────────────────────────
  // Validar schema (básico)
  // ───────────────────────────────────────────────────────────
  private validateToolArgs(tool: ToolDefinition, args: any): any {
    if (typeof args !== 'object' || args === null) {
      throw new BadRequestException('Argumentos devem ser um objeto');
    }

    // Verificar campos obrigatórios
    for (const required of tool.input_schema.required) {
      if (!(required in args)) {
        throw new BadRequestException(`Campo obrigatório ausente: ${required}`);
      }
    }

    return args;
  }

  // ───────────────────────────────────────────────────────────
  // Verificar permissão (mapeia tool → resource + action)
  // ───────────────────────────────────────────────────────────
  private async checkToolPermission(
    tool: ToolDefinition,
    args: any,
    user: CurrentUser,
  ): Promise<void> {
    const { permission } = tool;

    if (permission.type === 'module') {
      // Validar permissão de módulo
      checkModulePermission(user, permission.resource, permission.action);
    } else if (permission.type === 'entity') {
      // Validar permissão de entidade
      const entitySlug = args[permission.resource];
      if (!entitySlug) {
        throw new BadRequestException(`${permission.resource} é obrigatório`);
      }

      const hasPermission = await this.customRoleService.hasEntityPermission(
        user.id,
        entitySlug,
        permission.action,
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          `Você não tem permissão de ${permission.action} na entidade ${entitySlug}`,
        );
      }
    }
  }

  // ───────────────────────────────────────────────────────────
  // Aplicar scope (tenant + own/all)
  // ───────────────────────────────────────────────────────────
  private async applyScopeToArgs(
    toolName: string,
    args: any,
    user: CurrentUser,
  ): Promise<any> {
    const scopedArgs = { ...args };

    // Sempre adicionar tenantId (NUNCA confiar no input)
    scopedArgs.tenantId = user.tenantId;

    // Para operações de entity data, aplicar scope
    if (['search_records', 'get_record', 'export_data'].includes(toolName)) {
      const entitySlug = args.entitySlug;
      const scope = await this.customRoleService.getEntityScope(user.id, entitySlug);

      if (scope === 'own') {
        // Adicionar filtro de createdById automaticamente
        scopedArgs.createdById = user.id;
      }

      // Buscar dataFilters da role e aplicar
      const roleDataFilters = this.customRoleService.getRoleDataFilters(
        user.customRole,
        entitySlug,
      );

      if (roleDataFilters && roleDataFilters.length > 0) {
        // Merge com filtros existentes
        scopedArgs.filters = [...(scopedArgs.filters || []), ...roleDataFilters];
      }
    }

    return scopedArgs;
  }

  // ───────────────────────────────────────────────────────────
  // Mensagem de confirmação
  // ───────────────────────────────────────────────────────────
  private getConfirmationMessage(toolName: string, args: any): string {
    switch (toolName) {
      case 'delete_record':
        return `⚠️ Você está prestes a EXCLUIR um registro da entidade "${args.entitySlug}". Esta ação é irreversível. Deseja continuar?`;
      case 'update_record':
        return `Você está prestes a ATUALIZAR um registro da entidade "${args.entitySlug}". Deseja continuar?`;
      case 'trigger_webhook':
        return `Você está prestes a DISPARAR o webhook manualmente. Deseja continuar?`;
      case 'execute_action_chain':
        return `Você está prestes a EXECUTAR uma action chain. Deseja continuar?`;
      default:
        return `Esta ação requer confirmação. Deseja continuar?`;
    }
  }

  // ───────────────────────────────────────────────────────────
  // Executar tool (switch case)
  // ───────────────────────────────────────────────────────────
  private async executeToolInternal(
    toolName: string,
    args: any,
    user: CurrentUser,
  ): Promise<any> {
    switch (toolName) {
      case 'list_entities':
        return this.executeListEntities(user);

      case 'search_records':
        return this.executeSearchRecords(args, user);

      case 'get_record':
        return this.executeGetRecord(args, user);

      case 'create_record':
        return this.executeCreateRecord(args, user);

      case 'update_record':
        return this.executeUpdateRecord(args, user);

      case 'delete_record':
        return this.executeDeleteRecord(args, user);

      case 'get_current_user_info':
        return this.executeGetCurrentUserInfo(user);

      case 'navigate_to_page':
        return { action: 'navigate', path: args.path, openInNewTab: args.openInNewTab };

      case 'navigate_to_record':
        return {
          action: 'navigate',
          path: `/data/${args.entitySlug}/${args.recordId}?mode=${args.mode || 'view'}`,
        };

      case 'list_users':
        return this.executeListUsers(args, user);

      case 'check_permission':
        return this.executeCheckPermission(args, user);

      case 'export_data':
        return this.executeExportData(args, user);

      // Adicionar outros tools conforme necessário...

      default:
        throw new BadRequestException(`Tool não implementado: ${toolName}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // IMPLEMENTAÇÕES ESPECÍFICAS DE CADA TOOL
  // ═══════════════════════════════════════════════════════════

  private async executeListEntities(user: CurrentUser) {
    const entities = await this.entityService.findAll(user.tenantId);

    // Filtrar apenas entidades que o usuário tem permissão de ler
    const accessibleEntities = [];
    for (const entity of entities) {
      const hasAccess = await this.customRoleService.hasEntityPermission(
        user.id,
        entity.slug,
        'canRead',
      );
      if (hasAccess) {
        accessibleEntities.push({
          id: entity.id,
          name: entity.name,
          namePlural: entity.namePlural,
          slug: entity.slug,
          description: entity.description,
          icon: entity.icon,
          color: entity.color,
        });
      }
    }

    return {
      entities: accessibleEntities,
      total: accessibleEntities.length,
    };
  }

  private async executeSearchRecords(args: any, user: CurrentUser) {
    // Usa EntityDataQueryService (pipeline centralizado)
    const { where, entity } = await this.entityDataQueryService.buildWhere({
      entitySlug: args.entitySlug,
      user,
      filters: args.filters ? JSON.stringify(args.filters) : undefined,
      search: args.search,
    });

    const records = await this.prisma.entityData.findMany({
      where,
      take: Math.min(args.limit || 20, 100),
      orderBy: args.sortBy
        ? { [args.sortBy]: args.sortOrder || 'desc' }
        : { createdAt: 'desc' },
    });

    return {
      data: records.map((r) => ({
        id: r.id,
        data: r.data,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      entity: {
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
      },
      total: records.length,
    };
  }

  private async executeGetRecord(args: any, user: CurrentUser) {
    return this.dataService.findOne(args.entitySlug, args.recordId, user);
  }

  private async executeCreateRecord(args: any, user: CurrentUser) {
    return this.dataService.create(
      args.entitySlug,
      {
        data: args.data,
        parentRecordId: args.parentRecordId,
      },
      user,
    );
  }

  private async executeUpdateRecord(args: any, user: CurrentUser) {
    return this.dataService.update(
      args.entitySlug,
      args.recordId,
      { data: args.data },
      user,
    );
  }

  private async executeDeleteRecord(args: any, user: CurrentUser) {
    return this.dataService.remove(args.entitySlug, args.recordId, user);
  }

  private executeGetCurrentUserInfo(user: CurrentUser) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.customRole.name,
      roleType: user.customRole.roleType,
      tenantId: user.tenantId,
      permissions: {
        canAccessAllModules: ['PLATFORM_ADMIN', 'ADMIN'].includes(user.customRole.roleType),
        rolePermissions: user.customRole.permissions,
        modulePermissions: user.customRole.modulePermissions,
      },
    };
  }

  private async executeListUsers(args: any, user: CurrentUser) {
    const where: any = { tenantId: user.tenantId };

    if (args.search) {
      where.OR = [
        { name: { contains: args.search, mode: 'insensitive' } },
        { email: { contains: args.search, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      take: Math.min(args.limit || 20, 100),
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        customRole: {
          select: {
            id: true,
            name: true,
            roleType: true,
          },
        },
      },
    });

    return { users, total: users.length };
  }

  private async executeCheckPermission(args: any, user: CurrentUser) {
    // Detectar se é módulo ou entidade
    const isEntity = await this.prisma.entity.findFirst({
      where: { slug: args.resource, tenantId: user.tenantId },
    });

    let hasPermission: boolean;

    if (isEntity) {
      hasPermission = await this.customRoleService.hasEntityPermission(
        user.id,
        args.resource,
        args.action,
      );
    } else {
      try {
        checkModulePermission(user, args.resource, args.action);
        hasPermission = true;
      } catch {
        hasPermission = false;
      }
    }

    return {
      resource: args.resource,
      action: args.action,
      hasPermission,
      message: hasPermission
        ? `Usuário TEM permissão de ${args.action} em ${args.resource}`
        : `Usuário NÃO TEM permissão de ${args.action} em ${args.resource}`,
    };
  }

  private async executeExportData(args: any, user: CurrentUser) {
    // Delegar para DataController existente
    const exportResult = await this.dataService.export(
      args.entitySlug,
      {
        format: args.format || 'json',
        filters: args.filters ? JSON.stringify(args.filters) : undefined,
      },
      user,
    );

    return {
      message: 'Export gerado com sucesso',
      format: args.format || 'json',
      downloadUrl: exportResult.downloadUrl,
    };
  }
}
```

---

## 💰 Token Tracker Service

```typescript
// apps/api/src/modules/chat/services/token-tracker.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/common/services/redis.service';
import { CurrentUser } from '@/common/types/auth.types';

interface TokenUsageStats {
  used: number;
  budget: number;
  remaining: number;
  percentage: number;
  estimatedCost?: number; // USD
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

@Injectable()
export class TokenTrackerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // Budgets por roleType (tokens/mês)
  private readonly ROLE_BUDGETS: Record<string, number> = {
    PLATFORM_ADMIN: Infinity,
    ADMIN: 500000, // 500k tokens/mês
    MANAGER: 200000,
    USER: 50000,
    VIEWER: 10000,
  };

  // Budget por tenant (aggregate)
  private readonly TENANT_BUDGET = 5000000; // 5M tokens/mês

  // Preços Claude Haiku (por 1M tokens)
  private readonly PRICING = {
    input: 0.25, // $0.25 per MTok
    output: 1.25, // $1.25 per MTok
    cacheWrite: 0.30, // $0.30 per MTok
    cacheRead: 0.03, // $0.03 per MTok
  };

  // ───────────────────────────────────────────────────────────
  // Verificar budget ANTES de chamar API
  // ───────────────────────────────────────────────────────────
  async checkBudget(
    user: CurrentUser,
    estimatedTokens: number,
  ): Promise<{ allowed: boolean; remaining: number; message?: string }> {
    const month = new Date().toISOString().slice(0, 7); // '2026-03'

    // 1. Verificar budget do usuário
    const userKey = `tokens:user:${user.id}:${month}`;
    const userUsed = parseInt((await this.redis.get(userKey)) || '0');
    const userBudget = this.ROLE_BUDGETS[user.customRole.roleType] || 50000;
    const userRemaining = userBudget - userUsed;

    if (userRemaining < estimatedTokens) {
      return {
        allowed: false,
        remaining: userRemaining,
        message: `⚠️ Budget de tokens excedido. Você tem ${userRemaining.toLocaleString()} tokens restantes este mês (limite: ${userBudget.toLocaleString()}).`,
      };
    }

    // 2. Verificar budget do tenant (aggregate)
    const tenantKey = `tokens:tenant:${user.tenantId}:${month}`;
    const tenantUsed = parseInt((await this.redis.get(tenantKey)) || '0');
    const tenantRemaining = this.TENANT_BUDGET - tenantUsed;

    if (tenantRemaining < estimatedTokens) {
      return {
        allowed: false,
        remaining: tenantRemaining,
        message: `⚠️ Budget do tenant excedido. Restam ${tenantRemaining.toLocaleString()} tokens este mês (limite: ${this.TENANT_BUDGET.toLocaleString()}).`,
      };
    }

    return {
      allowed: true,
      remaining: Math.min(userRemaining, tenantRemaining),
    };
  }

  // ───────────────────────────────────────────────────────────
  // Registrar uso DEPOIS de receber response da API
  // ───────────────────────────────────────────────────────────
  async trackUsage(user: CurrentUser, usage: TokenUsage): Promise<void> {
    const month = new Date().toISOString().slice(0, 7);
    const totalTokens =
      usage.inputTokens +
      usage.outputTokens +
      (usage.cacheCreationTokens || 0) +
      (usage.cacheReadTokens || 0);

    // 1. Incrementar contador do usuário (Redis)
    const userKey = `tokens:user:${user.id}:${month}`;
    await this.redis.incrBy(userKey, totalTokens);
    await this.redis.expire(userKey, 60 * 60 * 24 * 31); // 31 dias

    // 2. Incrementar contador do tenant (Redis)
    const tenantKey = `tokens:tenant:${user.tenantId}:${month}`;
    await this.redis.incrBy(tenantKey, totalTokens);
    await this.redis.expire(tenantKey, 60 * 60 * 24 * 31);

    // 3. Calcular custo estimado
    const cost = this.calculateCost(usage);

    // 4. Persistir no banco (histórico + analytics)
    await this.prisma.tokenUsage.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        month,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheCreationTokens: usage.cacheCreationTokens || 0,
        cacheReadTokens: usage.cacheReadTokens || 0,
        totalTokens,
        timestamp: new Date(),
      },
    });
  }

  // ───────────────────────────────────────────────────────────
  // Buscar usage do usuário (para display em tempo real)
  // ───────────────────────────────────────────────────────────
  async getUserUsage(userId: string): Promise<TokenUsageStats> {
    const month = new Date().toISOString().slice(0, 7);
    const userKey = `tokens:user:${userId}:${month}`;
    const used = parseInt((await this.redis.get(userKey)) || '0');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customRole: true },
    });

    const budget = this.ROLE_BUDGETS[user.customRole.roleType] || 50000;
    const remaining = budget - used;
    const percentage = (used / budget) * 100;

    // Estimar custo (assumindo 50/50 input/output)
    const estimatedCost =
      (used * 0.5 * this.PRICING.input) / 1000000 +
      (used * 0.5 * this.PRICING.output) / 1000000;

    return {
      used,
      budget,
      remaining: Math.max(remaining, 0),
      percentage: Math.min(percentage, 100),
      estimatedCost,
    };
  }

  // ───────────────────────────────────────────────────────────
  // Buscar usage do tenant (para admins)
  // ───────────────────────────────────────────────────────────
  async getTenantUsage(tenantId: string): Promise<TokenUsageStats> {
    const month = new Date().toISOString().slice(0, 7);
    const tenantKey = `tokens:tenant:${tenantId}:${month}`;
    const used = parseInt((await this.redis.get(tenantKey)) || '0');

    const budget = this.TENANT_BUDGET;
    const remaining = budget - used;
    const percentage = (used / budget) * 100;

    const estimatedCost =
      (used * 0.5 * this.PRICING.input) / 1000000 +
      (used * 0.5 * this.PRICING.output) / 1000000;

    return {
      used,
      budget,
      remaining: Math.max(remaining, 0),
      percentage: Math.min(percentage, 100),
      estimatedCost,
    };
  }

  // ───────────────────────────────────────────────────────────
  // Calcular custo exato (USD)
  // ───────────────────────────────────────────────────────────
  private calculateCost(usage: TokenUsage): number {
    const inputCost = (usage.inputTokens * this.PRICING.input) / 1000000;
    const outputCost = (usage.outputTokens * this.PRICING.output) / 1000000;
    const cacheWriteCost =
      ((usage.cacheCreationTokens || 0) * this.PRICING.cacheWrite) / 1000000;
    const cacheReadCost =
      ((usage.cacheReadTokens || 0) * this.PRICING.cacheRead) / 1000000;

    return inputCost + outputCost + cacheWriteCost + cacheReadCost;
  }

  // ───────────────────────────────────────────────────────────
  // Estimar tokens de um prompt (heurística)
  // ───────────────────────────────────────────────────────────
  estimateTokens(text: string): number {
    // Heurística: ~4 chars = 1 token
    // Para ser conservador, usar 3 chars = 1 token
    return Math.ceil(text.length / 3);
  }
}
```

---

## 💬 Chat Service (Orchestration)

```typescript
// apps/api/src/modules/chat/services/chat.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ClaudeService } from './claude.service';
import { ToolExecutorService } from './tool-executor.service';
import { TokenTrackerService } from './token-tracker.service';
import { CurrentUser } from '@/common/types/auth.types';

export interface ChatStreamChunk {
  type:
    | 'token'
    | 'tool_call_start'
    | 'tool_call_result'
    | 'confirmation_required'
    | 'done'
    | 'error';
  content?: string;
  toolName?: string;
  args?: any;
  result?: any;
  message?: string;
  usage?: any;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly claudeService: ClaudeService,
    private readonly toolExecutor: ToolExecutorService,
    private readonly tokenTracker: TokenTrackerService,
  ) {}

  async sendMessage(
    conversationId: string,
    message: string,
    user: CurrentUser,
    context?: { currentPage?: string; entitySlug?: string; recordId?: string },
  ): Promise<AsyncIterableIterator<ChatStreamChunk>> {
    // 1. Verificar budget ANTES de chamar API
    const estimatedTokens = this.tokenTracker.estimateTokens(message);
    const budgetCheck = await this.tokenTracker.checkBudget(user, estimatedTokens);

    if (!budgetCheck.allowed) {
      throw new BadRequestException(budgetCheck.message);
    }

    // 2. Buscar ou criar conversation
    const conversation = await this.getOrCreateConversation(
      conversationId,
      user,
      context,
    );

    // 3. Salvar mensagem do usuário
    await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
        createdAt: new Date(),
      },
    });

    // 4. Buscar histórico (últimas 10 mensagens)
    const history = await this.getConversationHistory(conversation.id, 10);

    // 5. Construir context (system prompt + histórico)
    const systemContext = this.buildSystemContext(user, context);

    // 6. Chamar Claude API com streaming
    return this.streamClaudeResponse(
      conversation.id,
      systemContext,
      history,
      message,
      user,
    );
  }

  // ───────────────────────────────────────────────────────────
  // Stream response da API Claude
  // ───────────────────────────────────────────────────────────
  private async *streamClaudeResponse(
    conversationId: string,
    systemContext: string,
    history: any[],
    userMessage: string,
    user: CurrentUser,
  ): AsyncIterableIterator<ChatStreamChunk> {
    let assistantMessage = '';
    let usage: any = null;

    try {
      const stream = await this.claudeService.createMessageStream({
        system: [
          {
            type: 'text',
            text: systemContext,
            cache_control: { type: 'ephemeral' }, // Cache system prompt
          },
        ],
        messages: [
          ...history.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          { role: 'user', content: userMessage },
        ],
        tools: this.claudeService.getToolsForUser(user),
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          // Token de texto
          assistantMessage += chunk.delta.text;
          yield {
            type: 'token',
            content: chunk.delta.text,
          };
        }

        if (chunk.type === 'tool_use') {
          // Claude quer executar uma tool
          yield {
            type: 'tool_call_start',
            toolName: chunk.name,
            args: chunk.input,
          };

          // Executar tool
          const toolResult = await this.toolExecutor.executeTool(
            chunk.name,
            chunk.input,
            user,
            conversationId,
          );

          if (toolResult.requiresConfirmation) {
            // Pausar e pedir confirmação ao usuário
            yield {
              type: 'confirmation_required',
              toolName: chunk.name,
              args: chunk.input,
              message: toolResult.message,
            };
            return; // Stop stream, aguardar confirmação
          }

          // Tool executado com sucesso
          yield {
            type: 'tool_call_result',
            toolName: chunk.name,
            result: toolResult.result,
          };

          // Se tool retornou ação de navegação, enviar para frontend
          if (toolResult.result?.action === 'navigate') {
            yield {
              type: 'token',
              content: `\n\n[Redirecionando para ${toolResult.result.path}...]`,
            };
          }

          // Continuar stream com resultado da tool
          assistantMessage += `\n\n[Tool ${chunk.name} executado]`;
        }

        if (chunk.type === 'message_stop') {
          usage = chunk.usage;
        }
      }

      // 7. Salvar mensagem do assistente
      await this.prisma.chatMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content: assistantMessage,
          usage,
          createdAt: new Date(),
        },
      });

      // 8. Registrar uso de tokens
      if (usage) {
        await this.tokenTracker.trackUsage(user, usage);
      }

      // 9. Enviar token usage final
      const userUsage = await this.tokenTracker.getUserUsage(user.id);
      yield {
        type: 'done',
        usage: userUsage,
      };
    } catch (error) {
      yield {
        type: 'error',
        message: error.message,
      };
    }
  }

  // ───────────────────────────────────────────────────────────
  // Construir system prompt (contexto do usuário + instruções)
  // ───────────────────────────────────────────────────────────
  private buildSystemContext(
    user: CurrentUser,
    pageContext?: { currentPage?: string; entitySlug?: string; recordId?: string },
  ): string {
    let context = `Você é um assistente AI especializado no CRM Builder, uma plataforma SaaS multi-tenant para criação de CRMs personalizados.

## Contexto do Usuário
- **Nome**: ${user.name}
- **Email**: ${user.email}
- **Cargo**: ${user.customRole.name} (${user.customRole.roleType})
- **Tenant ID**: ${user.tenantId}`;

    if (pageContext?.currentPage) {
      context += `\n- **Página Atual**: ${pageContext.currentPage}`;
    }

    if (pageContext?.entitySlug) {
      context += `\n- **Entidade Ativa**: ${pageContext.entitySlug}`;
    }

    if (pageContext?.recordId) {
      context += `\n- **Registro Ativo**: ${pageContext.recordId}`;
    }

    context += `

## Suas Capacidades
- ✅ Buscar, criar, editar e deletar registros em entidades dinâmicas
- ✅ Navegar o usuário para páginas específicas do sistema
- ✅ Gerar relatórios, estatísticas e exports
- ✅ Executar automações, webhooks e action chains
- ✅ Gerenciar usuários (se tiver permissão)
- ✅ Gerar PDFs usando templates

## Regras CRÍTICAS de Segurança
1. **SEMPRE verifique permissões** antes de sugerir ações. Use \`check_permission\` se não tiver certeza.
2. **NUNCA execute ações destrutivas** (delete, update) sem explicar claramente o que será feito.
3. **Respeite o scope do usuário**: se ele tem scope 'own', só acessa seus próprios registros.
4. **Filtre por tenant**: TODAS as buscas devem ser dentro do tenant do usuário.
5. Para ações que requerem confirmação, explique o impacto antes de executar.

## Estilo de Comunicação
- Seja **conciso e objetivo** nas respostas
- Use **português do Brasil**
- Use **emojis** quando apropriado (📊 para dados, ✅ para sucesso, ⚠️ para avisos)
- Ao mostrar listas, use formatação markdown
- Se encontrar erros, explique de forma clara e sugira soluções

## Como Usar as Tools
- Use \`search_records\` para buscar dados (suporta filtros e pesquisa textual)
- Use \`navigate_to_page\` ou \`navigate_to_record\` para redirecionar o usuário
- Use \`create_record\` para criar novos registros (valide campos obrigatórios primeiro)
- Use \`get_current_user_info\` para entender as permissões do usuário
- Use \`list_entities\` para descobrir quais entidades existem

## Exemplos de Interação

**Usuário**: "Quantos leads ativos temos?"
**Você**:
1. Usar \`search_records\` com entitySlug='leads', filters=[{fieldSlug:'status',operator:'equals',value:'ativo'}]
2. Retornar: "📊 Você tem **42 leads ativos** no sistema."

**Usuário**: "Crie um novo cliente chamado João Silva"
**Você**:
1. Verificar se entidade 'clientes' existe (\`list_entities\`)
2. Perguntar campos obrigatórios (email, telefone, etc.)
3. Usar \`create_record\` após confirmar todos os dados
4. Retornar: "✅ Cliente **João Silva** criado com sucesso! [Clique aqui para visualizar](#)"

**Usuário**: "Me leve para a lista de produtos"
**Você**:
1. Usar \`navigate_to_page\` com path='/data/produtos'
2. Retornar: "✅ Redirecionando para a lista de produtos..."

Agora você está pronto para ajudar o usuário! 🚀`;

    return context;
  }

  // ───────────────────────────────────────────────────────────
  // Buscar ou criar conversation
  // ───────────────────────────────────────────────────────────
  private async getOrCreateConversation(
    conversationId: string | null,
    user: CurrentUser,
    context?: any,
  ) {
    if (conversationId) {
      const existing = await this.prisma.chatConversation.findFirst({
        where: { id: conversationId, userId: user.id },
      });
      if (existing) return existing;
    }

    // Criar nova conversation
    return this.prisma.chatConversation.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        context,
      },
    });
  }

  // ───────────────────────────────────────────────────────────
  // Buscar histórico (últimas N mensagens)
  // ───────────────────────────────────────────────────────────
  private async getConversationHistory(conversationId: string, limit: number) {
    return this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }
}
```

---

## 🎨 Frontend: Chat Widget (Next.js + React)

### Chat Widget Component

```typescript
// apps/web-admin/src/components/chat/chat-widget.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface TokenUsage {
  used: number;
  budget: number;
  remaining: number;
  percentage: number;
  estimatedCost?: number;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
  const [confirmationPending, setConfirmationPending] = useState<any>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const conversationId = useChatStore((s) => s.conversationId);
  const setConversationId = useChatStore((s) => s.setConversationId);

  // Auto-scroll ao receber novas mensagens
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Buscar token usage ao abrir
  useEffect(() => {
    if (isOpen && !tokenUsage) {
      fetchTokenUsage();
    }
  }, [isOpen]);

  const fetchTokenUsage = async () => {
    try {
      const res = await fetch('/api/chat/token-usage');
      const data = await res.json();
      setTokenUsage(data);
    } catch (error) {
      console.error('Erro ao buscar token usage:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Obter contexto da página atual
      const context = {
        currentPage: window.location.pathname,
        entitySlug: extractEntitySlug(),
        recordId: extractRecordId(),
      };

      // SSE streaming
      const eventSource = new EventSource(
        `/api/chat/stream?message=${encodeURIComponent(input)}&conversationId=${conversationId || ''}&context=${JSON.stringify(context)}`
      );

      let assistantMessage = '';
      const assistantId = (Date.now() + 1).toString();

      eventSource.onmessage = (event) => {
        const chunk = JSON.parse(event.data);

        if (chunk.type === 'token') {
          // Append texto
          assistantMessage += chunk.content;
          setMessages((prev) => {
            const existing = prev.find((m) => m.id === assistantId);
            if (existing) {
              return prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: assistantMessage }
                  : m
              );
            } else {
              return [
                ...prev,
                {
                  id: assistantId,
                  role: 'assistant',
                  content: assistantMessage,
                  timestamp: new Date(),
                },
              ];
            }
          });
        }

        if (chunk.type === 'tool_call_start') {
          // Mostrar loading
          assistantMessage += `\n\n🔧 Executando: ${chunk.toolName}...`;
        }

        if (chunk.type === 'tool_call_result') {
          // Verificar se é navegação
          if (chunk.result?.action === 'navigate') {
            // Redirecionar usuário
            if (chunk.result.openInNewTab) {
              window.open(chunk.result.path, '_blank');
            } else {
              window.location.href = chunk.result.path;
            }
          }
        }

        if (chunk.type === 'confirmation_required') {
          // Pausar stream e pedir confirmação
          setConfirmationPending({
            toolName: chunk.toolName,
            args: chunk.args,
            message: chunk.message,
          });
          eventSource.close();
          setIsLoading(false);
        }

        if (chunk.type === 'done') {
          // Atualizar token usage
          if (chunk.usage) {
            setTokenUsage(chunk.usage);
          }
          eventSource.close();
          setIsLoading(false);
        }

        if (chunk.type === 'error') {
          assistantMessage += `\n\n❌ Erro: ${chunk.message}`;
          eventSource.close();
          setIsLoading(false);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource.close();
        setIsLoading(false);
      };
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setIsLoading(false);
    }
  };

  const confirmAction = async () => {
    if (!confirmationPending) return;

    setConfirmationPending(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat/confirm-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          toolName: confirmationPending.toolName,
          args: confirmationPending.args,
        }),
      });

      const result = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `✅ Ação executada com sucesso!\n\n${JSON.stringify(result, null, 2)}`,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Erro ao confirmar ação:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelAction = () => {
    setConfirmationPending(null);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: '❌ Ação cancelada pelo usuário.',
        timestamp: new Date(),
      },
    ]);
  };

  const extractEntitySlug = () => {
    const match = window.location.pathname.match(/\/data\/([^\/]+)/);
    return match ? match[1] : undefined;
  };

  const extractRecordId = () => {
    const match = window.location.pathname.match(/\/data\/[^\/]+\/([^\/]+)/);
    return match ? match[1] : undefined;
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-[400px] h-[600px] flex flex-col shadow-2xl z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <div>
            <h3 className="font-semibold">Assistente CRM</h3>
            <p className="text-xs text-muted-foreground">Claude Haiku</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Token Usage */}
      {tokenUsage && (
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Tokens restantes</span>
            <span className="font-semibold">
              {tokenUsage.remaining.toLocaleString()} / {tokenUsage.budget.toLocaleString()}
            </span>
          </div>
          <Progress value={100 - tokenUsage.percentage} className="h-1" />
          {tokenUsage.estimatedCost && (
            <p className="text-xs text-muted-foreground mt-1">
              Custo estimado: ${tokenUsage.estimatedCost.toFixed(4)}
            </p>
          )}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Como posso ajudar você hoje?</p>
            <div className="mt-4 text-xs space-y-1">
              <p>• Buscar registros em entidades</p>
              <p>• Criar ou editar dados</p>
              <p>• Gerar relatórios</p>
              <p>• Navegar no sistema</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'mb-4 flex',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-lg p-3 text-sm',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              <div className="text-xs opacity-60 mt-1">
                {message.timestamp.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <div
                  className="w-2 h-2 bg-primary rounded-full animate-pulse"
                  style={{ animationDelay: '0.2s' }}
                />
                <div
                  className="w-2 h-2 bg-primary rounded-full animate-pulse"
                  style={{ animationDelay: '0.4s' }}
                />
              </div>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Confirmation Dialog */}
      {confirmationPending && (
        <div className="p-4 border-t bg-yellow-50 dark:bg-yellow-900/20">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">Confirmação Necessária</p>
              <p className="text-muted-foreground">{confirmationPending.message}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={confirmAction}
              className="flex-1"
              size="sm"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Confirmar
            </Button>
            <Button
              onClick={cancelAction}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
```

### Layout Provider (Adicionar em todas as páginas)

```typescript
// apps/web-admin/src/app/(dashboard)/layout.tsx

import { ChatWidget } from '@/components/chat/chat-widget';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChatWidget />
    </>
  );
}
```

---

## 📝 Plano de Implementação

### Fase 1: Backend Base (1 semana)

- [ ] Criar schema Prisma (ChatConversation, ChatMessage, ToolCallLog, TokenUsage)
- [ ] Migrar banco de dados
- [ ] Criar ChatModule, ChatController, ChatService
- [ ] Implementar ClaudeService (integração com Anthropic API)
- [ ] Criar Tool Registry (todas as 30+ tools)
- [ ] Implementar ToolExecutorService (validação + execução)
- [ ] Testes unitários dos services

### Fase 2: Segurança & RBAC (3 dias)

- [ ] Implementar validação de permissões por tool
- [ ] Aplicar scope automático (tenant + own/all)
- [ ] Adicionar dataFilters automáticos
- [ ] Criar ChatLoggerService (audit trail)
- [ ] Implementar confirmação para ações destrutivas
- [ ] Testes de segurança (tentar burlar permissões)

### Fase 3: Token Budget (2 dias)

- [ ] Criar TokenTrackerService
- [ ] Configurar Redis para counters
- [ ] Implementar check de budget antes da API
- [ ] Implementar tracking após response
- [ ] Criar endpoint /api/chat/token-usage
- [ ] Dashboard de analytics (admin)

### Fase 4: Frontend Chat Widget (1 semana)

- [ ] Criar ChatWidget component
- [ ] Implementar streaming SSE
- [ ] UI de mensagens (user + assistant)
- [ ] Token counter display
- [ ] Confirmation dialog
- [ ] Navigation handler (redirecionamento)
- [ ] Integrar em todas as páginas via layout
- [ ] Responsividade mobile

### Fase 5: Tools Implementation (1 semana)

- [ ] Implementar todos os 30+ tools
- [ ] Testar cada tool individualmente
- [ ] Validar permissões de cada tool
- [ ] Documentar cada tool (descrição, exemplos)
- [ ] Testes E2E de fluxos completos

### Fase 6: Testing & Refinement (3 dias)

- [ ] Testes E2E de conversas
- [ ] Teste de streaming longo
- [ ] Teste de token budget limits
- [ ] Teste de permissões (roles diferentes)
- [ ] Teste de ações destrutivas
- [ ] Load testing (múltiplos usuários)
- [ ] Ajustes de UX baseado em feedback

### Fase 7: Documentação & Deploy (2 dias)

- [ ] Documentar arquitetura
- [ ] Guia de uso para usuários finais
- [ ] Configurar variáveis de ambiente (CLAUDE_API_KEY)
- [ ] Deploy em produção
- [ ] Monitoramento de custos
- [ ] Training dos admins

---

## 🚀 Variáveis de Ambiente

```env
# apps/api/.env

# Claude API
CLAUDE_API_KEY=sk-ant-api03-xxx
CLAUDE_MODEL=claude-haiku-4-5-20251001
CLAUDE_MAX_TOKENS=4096

# Redis (Token tracking)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Budgets
TOKEN_BUDGET_ADMIN=500000
TOKEN_BUDGET_MANAGER=200000
TOKEN_BUDGET_USER=50000
TOKEN_BUDGET_VIEWER=10000
TOKEN_BUDGET_TENANT=5000000
```

---

## 📊 Monitoramento & Analytics

### Dashboard de Métricas (Admin)

```typescript
// apps/web-admin/src/app/(dashboard)/admin/chat-analytics/page.tsx

export default async function ChatAnalyticsPage() {
  const stats = await getChatStats();

  return (
    <div className="space-y-6">
      <h1>Análise de Uso do Bot</h1>

      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Total de Conversas" value={stats.totalConversations} />
        <StatCard title="Total de Mensagens" value={stats.totalMessages} />
        <StatCard title="Tokens Usados (mês)" value={stats.tokensUsedThisMonth} />
        <StatCard title="Custo Estimado" value={`$${stats.estimatedCost}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Tools Executados</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart data={stats.topTools} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uso por Usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={userUsageColumns} data={stats.userUsage} />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## ✅ Checklist de Segurança

- [x] Multi-tenancy: tenantId em TODAS as queries
- [x] RBAC: Validação de permissões antes de CADA tool
- [x] Scope: Aplicação automática de own/all
- [x] DataFilters: Aplicação automática de roleDataFilters
- [x] Confirmação: Ações destrutivas requerem aprovação
- [x] Audit Log: Todas as tool calls são logadas
- [x] Token Budget: Limites por usuário e tenant
- [x] Rate Limiting: Throttle em endpoints de chat
- [x] Input Validation: Schema validation de todos os args
- [x] Error Handling: Nunca expor stack traces
- [x] API Key: Nunca expor no frontend
- [x] HTTPS: Comunicação criptografada

---

## 💡 Melhorias Futuras

### Fase 2 (pós-MVP)

- [ ] **RAG (Retrieval Augmented Generation)**: Buscar documentação interna via embeddings
- [ ] **Multi-turn tools**: Claude pode executar múltiplas tools em sequência
- [ ] **Undo/Redo**: Desfazer ações executadas pelo bot
- [ ] **Voice Input**: Usar Web Speech API para entrada por voz
- [ ] **Suggestions**: Bot sugere ações baseado no contexto da página
- [ ] **Scheduled messages**: Usuário pode agendar ações para executar depois
- [ ] **Shared conversations**: Compartilhar conversas com outros usuários
- [ ] **Export conversations**: Exportar histórico em PDF/Markdown
- [ ] **Fine-tuning**: Treinar modelo custom com dados do CRM
- [ ] **Analytics avançado**: Identificar padrões de uso, perguntas frequentes

---

## 📚 Referências

- [Anthropic Claude API Documentation](https://docs.anthropic.com/en/api/messages)
- [Tool Use (Function Calling) Guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [Streaming Messages](https://docs.anthropic.com/en/api/messages-streaming)
- [Claude Haiku Pricing](https://www.anthropic.com/pricing#anthropic-api)
- [Best Practices for AI Agents](https://www.anthropic.com/research/building-effective-agents)

---

## 🎉 Conclusão

Esta proposta implementa um **bot Claude API completo e seguro** para o CRM Builder, com:

✅ **Segurança em primeiro lugar**: RBAC, multi-tenancy, confirmações
✅ **Controle de custos**: Token budgets por usuário e tenant
✅ **Audit completo**: Todos os logs de ações
✅ **UX moderna**: Chat floating, streaming, redirecionamento
✅ **Escalável**: Arquitetura modular, fácil adicionar novos tools

**Tempo estimado total**: 3-4 semanas de desenvolvimento full-time

**Custo mensal estimado** (Claude Haiku):
- 50 usuários ativos
- Média de 100 mensagens/usuário/mês
- ~1000 tokens/mensagem
- **Total**: ~5M tokens/mês = **$6.25/mês** 🎯

**ROI**: Altíssimo! Usuários ganham produtividade massiva ao automatizar buscas, navegação e ações via linguagem natural.
