# 🗺️ ROADMAP DETALHADO - CRM BUILDER

> **Princípio**: Cada item é independente e pode ser implementado isoladamente
>
> **Data**: 2026-04-09

---

## 📋 ÍNDICE

- [FASE 1: ESTABILIDADE](#fase-1-estabilidade-crítica)
- [FASE 2: ESCALABILIDADE](#fase-2-escalabilidade)
- [FASE 3: FEATURES CORE](#fase-3-features-core)
- [FASE 4: INTEGRAÇÕES](#fase-4-integrações)
- [FASE 5: UX & POLISH](#fase-5-ux--polish)
- [FASE 6: TECH DEBT](#fase-6-tech-debt)

---

# FASE 1: ESTABILIDADE (CRÍTICA)

> **Objetivo**: Garantir que sistema não trave em produção
> **Duração estimada**: 2 semanas
> **Prioridade**: 🔴 CRÍTICA

---

## 1.1 - Sistema de Fila para Automações

**Status**: ⏸️ Não iniciado
**Prioridade**: 🔴 CRÍTICA
**Estimativa**: 4 dias
**Dependências**: Nenhuma

### Por que fazer?
Automações síncronas travam a API quando:
- Automation tem 10+ ações
- Envia emails em lote
- Cria múltiplos registros

### Pré-requisitos
```bash
# Instalar dependências
cd apps/api
pnpm add bull @nestjs/bull
pnpm add -D @types/bull

# Redis já deve estar rodando (usado pelo Socket.IO)
docker ps | grep redis
```

### Passo a Passo

#### Step 1: Setup Bull Module (30min)
```typescript
// apps/api/src/modules/automation-queue/automation-queue.module.ts
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    BullModule.registerQueue({
      name: 'automation-execution',
    }),
  ],
  providers: [AutomationQueueProcessor],
  exports: [BullModule],
})
export class AutomationQueueModule {}
```

#### Step 2: Criar Processor (2h)
```typescript
// apps/api/src/modules/automation-queue/automation-queue.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

interface AutomationJob {
  automationId: string;
  recordId: string;
  trigger: string;
  userId: string;
  tenantId: string;
}

@Processor('automation-execution')
export class AutomationQueueProcessor {
  constructor(
    private readonly automationExecutor: AutomationExecutorService,
    private readonly logger: Logger,
  ) {}

  @Process()
  async handleAutomation(job: Job<AutomationJob>) {
    const { automationId, recordId, trigger, userId, tenantId } = job.data;

    this.logger.log(
      `[Queue] Executando automation ${automationId} para record ${recordId}`
    );

    try {
      await this.automationExecutor.execute({
        automationId,
        recordId,
        trigger,
        userId,
        tenantId,
      });

      this.logger.log(`[Queue] Automation ${automationId} concluída`);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `[Queue] Erro na automation ${automationId}: ${error.message}`,
        error.stack
      );
      throw error; // Bull vai retentar automaticamente
    }
  }
}
```

#### Step 3: Atualizar DataService (1h)
```typescript
// apps/api/src/modules/data/data.service.ts
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export class DataService {
  constructor(
    @InjectQueue('automation-execution') private automationQueue: Queue,
    // ... outros
  ) {}

  private async triggerAutomations(/* ... */) {
    const automations = await this.getAutomations(/* ... */);

    for (const automation of automations) {
      // ANTES (síncrono):
      // await this.automationExecutor.execute(automation);

      // DEPOIS (async via queue):
      await this.automationQueue.add({
        automationId: automation.id,
        recordId: record.id,
        trigger,
        userId: user.sub,
        tenantId: effectiveTenantId,
      }, {
        attempts: 3, // Retry até 3x
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s, 4s, 8s
        },
        removeOnComplete: 100, // Manter últimos 100 jobs
        removeOnFail: 500, // Manter últimos 500 erros
      });
    }
  }
}
```

#### Step 4: Dashboard de Monitoramento (4h)
```typescript
// apps/api/src/modules/automation-queue/automation-queue.controller.ts
@Controller('automation-queue')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class AutomationQueueController {
  constructor(@InjectQueue('automation-execution') private queue: Queue) {}

  @Get('stats')
  @RequirePermission('automations', 'read')
  async getStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  @Get('jobs/failed')
  @RequirePermission('automations', 'read')
  async getFailedJobs(@Query('limit') limit = 50) {
    const failed = await this.queue.getFailed(0, limit);
    return failed.map(job => ({
      id: job.id,
      data: job.data,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      timestamp: job.timestamp,
    }));
  }

  @Post('jobs/:id/retry')
  @RequirePermission('automations', 'update')
  async retryJob(@Param('id') jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundException();
    await job.retry();
    return { success: true };
  }
}
```

#### Step 5: Frontend - Queue Monitor (3h)
```tsx
// apps/web-admin/src/app/(dashboard)/automations/queue/page.tsx
export default function AutomationQueuePage() {
  const { data: stats } = useQuery({
    queryKey: ['automation-queue', 'stats'],
    queryFn: () => api.get('/automation-queue/stats'),
    refetchInterval: 5000, // Atualiza a cada 5s
  });

  const { data: failedJobs } = useQuery({
    queryKey: ['automation-queue', 'failed'],
    queryFn: () => api.get('/automation-queue/jobs/failed'),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Fila de Automações</h1>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Aguardando" value={stats?.waiting} />
        <StatCard label="Executando" value={stats?.active} />
        <StatCard label="Concluídas" value={stats?.completed} color="green" />
        <StatCard label="Falharam" value={stats?.failed} color="red" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jobs Falhados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Automation</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {failedJobs?.map(job => (
                <TableRow key={job.id}>
                  <TableCell>{job.id}</TableCell>
                  <TableCell>{job.data.automationId}</TableCell>
                  <TableCell className="text-red-600">{job.failedReason}</TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => retryJob(job.id)}>
                      Retentar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Testes de Validação

```bash
# 1. Criar automation com delay
# 2. Criar 100 registros simultaneamente
# 3. Verificar:
#    - API responde rápido (< 200ms)
#    - Jobs na fila (GET /automation-queue/stats)
#    - Execuções completam em background
```

### Critérios de Conclusão

- [ ] Bull configurado e rodando
- [ ] Automations executam via queue
- [ ] API response time < 200ms (antes: 2-10s)
- [ ] Retry automático funciona
- [ ] Dashboard mostra stats em tempo real
- [ ] Pode retentar jobs falhados manualmente

---

## 1.2 - Cache de Permissions

**Status**: ⏸️ Não iniciado
**Prioridade**: 🔴 CRÍTICA
**Estimativa**: 2 dias
**Dependências**: Redis (já usado)

### Por que fazer?
Cada request faz 3-5 queries de permissions:
- `CustomRole.findUnique`
- `Entity.findMany` (para entityPermissions)
- `User.findUnique`

Com cache: **1 query inicial + cache hit**

### Pré-requisitos
```bash
cd apps/api
pnpm add ioredis
pnpm add -D @types/ioredis
```

### Passo a Passo

#### Step 1: Redis Service (1h)
```typescript
// apps/api/src/common/services/redis.service.ts
import Redis from 'ioredis';
import { Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.client.on('error', (err) => {
      console.error('Redis error:', err);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const stringValue = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, stringValue);
    } else {
      await this.client.set(key, stringValue);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  onModuleDestroy() {
    this.client.quit();
  }
}
```

#### Step 2: Permission Cache Service (2h)
```typescript
// apps/api/src/modules/custom-role/permission-cache.service.ts
@Injectable()
export class PermissionCacheService {
  private readonly TTL = 300; // 5 minutos

  constructor(private readonly redis: RedisService) {}

  private getUserPermissionKey(userId: string, tenantId: string): string {
    return `permissions:${tenantId}:user:${userId}`;
  }

  private getRolePermissionKey(roleId: string): string {
    return `permissions:role:${roleId}`;
  }

  async getUserPermissions(
    userId: string,
    tenantId: string
  ): Promise<UserPermissions | null> {
    const key = this.getUserPermissionKey(userId, tenantId);
    return await this.redis.get<UserPermissions>(key);
  }

  async setUserPermissions(
    userId: string,
    tenantId: string,
    permissions: UserPermissions
  ): Promise<void> {
    const key = this.getUserPermissionKey(userId, tenantId);
    await this.redis.set(key, permissions, this.TTL);
  }

  async invalidateUserPermissions(userId: string, tenantId: string): Promise<void> {
    const key = this.getUserPermissionKey(userId, tenantId);
    await this.redis.del(key);
  }

  async invalidateRolePermissions(roleId: string): Promise<void> {
    // Invalidar role específica
    const roleKey = this.getRolePermissionKey(roleId);
    await this.redis.del(roleKey);

    // Invalidar todos os users com essa role
    // (eles vão re-cachear na próxima request)
  }

  async invalidateTenantPermissions(tenantId: string): Promise<void> {
    // Invalidar todos os users desse tenant
    await this.redis.delPattern(`permissions:${tenantId}:*`);
  }
}
```

#### Step 3: Integrar no PermissionService (1h)
```typescript
// apps/api/src/modules/custom-role/permission.service.ts
export class PermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: PermissionCacheService,
  ) {}

  async getUserPermissions(userId: string, tenantId: string) {
    // Tentar cache primeiro
    const cached = await this.cache.getUserPermissions(userId, tenantId);
    if (cached) {
      return cached;
    }

    // Cache miss - buscar do banco
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        customRole: {
          include: { permissions: true },
        },
      },
    });

    if (!user) throw new NotFoundException();

    const permissions: UserPermissions = {
      roleType: user.customRole.roleType,
      modulePermissions: user.customRole.modulePermissions,
      entityPermissions: user.customRole.permissions,
    };

    // Salvar no cache
    await this.cache.setUserPermissions(userId, tenantId, permissions);

    return permissions;
  }
}
```

#### Step 4: Invalidação em Mutations (1h)
```typescript
// apps/api/src/modules/custom-role/custom-role.service.ts
export class CustomRoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: PermissionCacheService,
  ) {}

  async update(id: string, dto: UpdateCustomRoleDto, user: CurrentUser) {
    const updated = await this.prisma.customRole.update({
      where: { id },
      data: dto,
    });

    // INVALIDAR CACHE
    await this.cache.invalidateRolePermissions(id);

    return updated;
  }

  async assignRoleToUser(roleId: string, userId: string, tenantId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { customRoleId: roleId },
    });

    // INVALIDAR CACHE DO USUÁRIO
    await this.cache.invalidateUserPermissions(userId, tenantId);
  }
}
```

#### Step 5: Testes (2h)
```typescript
// apps/api/src/modules/custom-role/permission-cache.service.spec.ts
describe('PermissionCacheService', () => {
  let service: PermissionCacheService;
  let redis: RedisService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PermissionCacheService, RedisService],
    }).compile();

    service = module.get(PermissionCacheService);
    redis = module.get(RedisService);
  });

  it('deve cachear permissions', async () => {
    const userId = 'user-123';
    const tenantId = 'tenant-456';
    const permissions = { roleType: 'USER', modulePermissions: {} };

    await service.setUserPermissions(userId, tenantId, permissions);
    const cached = await service.getUserPermissions(userId, tenantId);

    expect(cached).toEqual(permissions);
  });

  it('deve invalidar cache quando role muda', async () => {
    const userId = 'user-123';
    const tenantId = 'tenant-456';
    const permissions = { roleType: 'USER', modulePermissions: {} };

    await service.setUserPermissions(userId, tenantId, permissions);
    await service.invalidateUserPermissions(userId, tenantId);

    const cached = await service.getUserPermissions(userId, tenantId);
    expect(cached).toBeNull();
  });
});
```

### Testes de Validação

```bash
# 1. Fazer 1000 requests autenticados
ab -n 1000 -c 10 -H "Authorization: Bearer TOKEN" \
   http://localhost:3001/api/v1/data/users

# 2. Verificar logs Redis
#    - Cache hits devem ser > 95%
#    - Queries de permissions devem cair 90%+

# 3. Atualizar role
PATCH /custom-roles/:id

# 4. Verificar que cache foi invalidado
#    - Próximo request deve re-cachear
```

### Critérios de Conclusão

- [ ] Redis service implementado
- [ ] Cache de permissions funcionando
- [ ] Cache hit rate > 95%
- [ ] Invalidação automática em updates
- [ ] Testes unitários passando
- [ ] Latência reduzida em ~30-50ms

---

## 1.3 - Detecção de Loops Infinitos

**Status**: ⏸️ Não iniciado
**Prioridade**: 🔴 CRÍTICA
**Estimativa**: 2 dias
**Dependências**: Nenhuma

### Por que fazer?
Cenário real:
```
Automation A: ON_CREATE em "Leads" → Cria "Oportunidade"
Automation B: ON_CREATE em "Oportunidades" → Cria "Lead"
Resultado: Loop infinito, API trava
```

### Pré-requisitos
Nenhum - apenas lógica no código

### Passo a Passo

#### Step 1: Execution Context Tracker (2h)
```typescript
// apps/api/src/modules/entity-automation/execution-context.service.ts
export interface ExecutionContext {
  automationId: string;
  recordId: string;
  trigger: string;
  depth: number;
  path: string[]; // ["automation-1", "automation-2", ...]
}

@Injectable()
export class ExecutionContextService {
  private readonly MAX_DEPTH = 5;
  private readonly contexts = new Map<string, ExecutionContext>();

  getContextKey(recordId: string): string {
    return `exec:${recordId}`;
  }

  startExecution(
    automationId: string,
    recordId: string,
    trigger: string,
    parentContext?: ExecutionContext
  ): ExecutionContext {
    const depth = parentContext ? parentContext.depth + 1 : 0;
    const path = parentContext
      ? [...parentContext.path, automationId]
      : [automationId];

    // DETECTAR LOOP
    if (path.filter(id => id === automationId).length > 1) {
      throw new LoopDetectedException(
        `Loop detectado: automation ${automationId} já foi executada neste contexto`,
        path
      );
    }

    // DETECTAR MAX DEPTH
    if (depth > this.MAX_DEPTH) {
      throw new MaxDepthExceededException(
        `Profundidade máxima excedida (${this.MAX_DEPTH})`,
        path
      );
    }

    const context: ExecutionContext = {
      automationId,
      recordId,
      trigger,
      depth,
      path,
    };

    const key = this.getContextKey(recordId);
    this.contexts.set(key, context);

    return context;
  }

  endExecution(recordId: string): void {
    const key = this.getContextKey(recordId);
    this.contexts.delete(key);
  }

  getContext(recordId: string): ExecutionContext | undefined {
    const key = this.getContextKey(recordId);
    return this.contexts.get(key);
  }
}
```

#### Step 2: Integrar no Executor (1h)
```typescript
// apps/api/src/modules/entity-automation/automation-executor.service.ts
export class AutomationExecutorService {
  constructor(
    private readonly contextService: ExecutionContextService,
    private readonly logger: Logger,
  ) {}

  async execute(
    automation: EntityAutomation,
    record: EntityData,
    trigger: string,
    user: CurrentUser
  ) {
    // Pegar contexto pai (se estiver executando dentro de outra automation)
    const parentContext = this.contextService.getContext(record.id);

    try {
      // Iniciar contexto (pode lançar LoopDetectedException)
      const context = this.contextService.startExecution(
        automation.id,
        record.id,
        trigger,
        parentContext
      );

      this.logger.log(
        `[Automation] Executando ${automation.name} (depth: ${context.depth}, path: ${context.path.join(' → ')})`
      );

      // Executar ações...
      for (const action of automation.actions) {
        await this.executeAction(action, record, context);
      }

      return { success: true };
    } catch (error) {
      if (error instanceof LoopDetectedException) {
        this.logger.error(
          `[Automation] LOOP DETECTADO: ${error.message}`,
          error.path
        );

        // Criar alerta para admin
        await this.createAlert({
          type: 'AUTOMATION_LOOP',
          automationId: automation.id,
          recordId: record.id,
          path: error.path,
        });
      }

      throw error;
    } finally {
      // Limpar contexto
      this.contextService.endExecution(record.id);
    }
  }

  private async executeAction(
    action: AutomationAction,
    record: EntityData,
    context: ExecutionContext
  ) {
    if (action.type === 'create_record') {
      // Criar registro pode disparar outras automations
      // Passar contexto para detectar loop
      const created = await this.dataService.create(
        action.config.entitySlug,
        action.config.data,
        { ...context } // Propagar contexto
      );

      return created;
    }

    // ... outras ações
  }
}
```

#### Step 3: Circuit Breaker por Automation (2h)
```typescript
// apps/api/src/modules/entity-automation/circuit-breaker.service.ts
interface CircuitState {
  failures: number;
  lastFailure: Date;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

@Injectable()
export class CircuitBreakerService {
  private readonly circuits = new Map<string, CircuitState>();
  private readonly FAILURE_THRESHOLD = 5; // 5 falhas consecutivas
  private readonly TIMEOUT = 60000; // 1 minuto
  private readonly HALF_OPEN_ATTEMPTS = 3;

  async call<T>(
    automationId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const circuit = this.getCircuit(automationId);

    // Circuit OPEN - não executar
    if (circuit.state === 'OPEN') {
      const timeSinceFailure = Date.now() - circuit.lastFailure.getTime();

      if (timeSinceFailure < this.TIMEOUT) {
        throw new CircuitOpenException(
          `Automation ${automationId} temporariamente desabilitada devido a falhas repetidas`
        );
      }

      // Timeout expirou - tentar HALF_OPEN
      circuit.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();

      // Sucesso - resetar circuit
      if (circuit.state === 'HALF_OPEN') {
        circuit.state = 'CLOSED';
        circuit.failures = 0;
      }

      return result;
    } catch (error) {
      // Falha - incrementar contador
      circuit.failures++;
      circuit.lastFailure = new Date();

      if (circuit.failures >= this.FAILURE_THRESHOLD) {
        circuit.state = 'OPEN';

        // Criar alerta
        await this.createAlert({
          type: 'CIRCUIT_BREAKER_OPEN',
          automationId,
          failures: circuit.failures,
        });
      }

      throw error;
    }
  }

  private getCircuit(automationId: string): CircuitState {
    if (!this.circuits.has(automationId)) {
      this.circuits.set(automationId, {
        failures: 0,
        lastFailure: new Date(),
        state: 'CLOSED',
      });
    }
    return this.circuits.get(automationId)!;
  }

  async reset(automationId: string): Promise<void> {
    this.circuits.delete(automationId);
  }
}
```

#### Step 4: Dashboard de Alertas (3h)
```tsx
// apps/web-admin/src/app/(dashboard)/automations/alerts/page.tsx
export default function AutomationAlertsPage() {
  const { data: alerts } = useQuery({
    queryKey: ['automation-alerts'],
    queryFn: () => api.get('/automation-alerts'),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Alertas de Automações</h1>

      {alerts?.map(alert => (
        <Alert key={alert.id} variant={alert.type === 'LOOP' ? 'destructive' : 'warning'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {alert.type === 'LOOP' ? 'Loop Infinito Detectado' : 'Circuit Breaker Aberto'}
          </AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p>Automation: <strong>{alert.automationName}</strong></p>

              {alert.type === 'LOOP' && (
                <div>
                  <p className="font-medium">Caminho de execução:</p>
                  <code className="text-xs bg-muted p-2 rounded block mt-1">
                    {alert.path.join(' → ')}
                  </code>
                </div>
              )}

              {alert.type === 'CIRCUIT_BREAKER' && (
                <p>Falhas consecutivas: <strong>{alert.failures}</strong></p>
              )}

              <div className="flex gap-2 mt-4">
                <Button size="sm" onClick={() => viewAutomation(alert.automationId)}>
                  Ver Automation
                </Button>
                <Button size="sm" variant="outline" onClick={() => dismissAlert(alert.id)}>
                  Dispensar
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
```

### Testes de Validação

```typescript
// Teste de loop detection
describe('Loop Detection', () => {
  it('deve detectar loop direto (A → A)', async () => {
    // Automation que cria registro na mesma entidade
    const automation = {
      trigger: 'ON_CREATE',
      actions: [{ type: 'create_record', config: { entitySlug: 'same' } }],
    };

    await expect(
      executor.execute(automation, record, 'created', user)
    ).rejects.toThrow(LoopDetectedException);
  });

  it('deve detectar loop indireto (A → B → A)', async () => {
    // Criar 2 automations que se chamam
    const automationA = { /* cria B */ };
    const automationB = { /* cria A */ };

    await expect(
      executor.execute(automationA, recordA, 'created', user)
    ).rejects.toThrow(LoopDetectedException);
  });

  it('deve permitir recursão limitada (depth < 5)', async () => {
    // Automation que cria 3 níveis de registros
    const automation = { /* cria child */ };

    // Deve funcionar até depth 5
    await expect(
      executor.execute(automation, record, 'created', user)
    ).resolves.toBeDefined();
  });
});
```

### Critérios de Conclusão

- [ ] ExecutionContextService implementado
- [ ] Loop detection funcionando (direto e indireto)
- [ ] Max depth enforcement (5 níveis)
- [ ] Circuit breaker por automation
- [ ] Dashboard de alertas
- [ ] Testes unitários passando
- [ ] Alertas enviados para admins

---

## 1.4 - TTL em Audit Logs

**Status**: ⏸️ Não iniciado
**Prioridade**: 🟡 IMPORTANTE
**Estimativa**: 1-2 dias
**Dependências**: Nenhuma

### Por que fazer?
Audit logs crescem ~1GB/mês em produção.
Após 1 ano = 12GB só de logs.

### Passo a Passo

#### Step 1: Archive Service (2h)
```typescript
// apps/api/src/modules/audit/audit-archive.service.ts
@Injectable()
export class AuditArchiveService {
  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *') // Todo dia às 3h AM
  async archiveOldLogs() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 dias atrás

    // 1. Buscar logs antigos em lotes
    let archived = 0;
    let hasMore = true;

    while (hasMore) {
      const logs = await this.prisma.auditLog.findMany({
        where: {
          createdAt: { lt: cutoffDate },
          archived: false,
        },
        take: 1000,
      });

      if (logs.length === 0) {
        hasMore = false;
        break;
      }

      // 2. Mover para tabela de archive
      await this.prisma.archivedAuditLog.createMany({
        data: logs.map(log => ({
          ...log,
          archivedAt: new Date(),
        })),
      });

      // 3. Deletar da tabela principal
      await this.prisma.auditLog.deleteMany({
        where: {
          id: { in: logs.map(l => l.id) },
        },
      });

      archived += logs.length;
    }

    console.log(`Arquivados ${archived} audit logs`);
  }

  @Cron('0 4 * * 0') // Todo domingo às 4h AM
  async deleteVeryOldLogs() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365); // 1 ano atrás

    const deleted = await this.prisma.archivedAuditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    console.log(`Deletados ${deleted.count} audit logs arquivados`);
  }
}
```

#### Step 2: Migration (30min)
```sql
-- prisma/migrations/XXX_add_archived_audit_logs.sql
CREATE TABLE "ArchivedAuditLog" (
  "id" TEXT PRIMARY KEY,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "oldData" JSONB,
  "newData" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP NOT NULL,
  "archivedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "ArchivedAuditLog_tenantId_createdAt_idx"
  ON "ArchivedAuditLog"("tenantId", "createdAt");
```

#### Step 3: Query Service (1h)
```typescript
// apps/api/src/modules/audit/audit.service.ts
export class AuditService {
  async findAll(query: FindAuditLogsDto, user: CurrentUser) {
    const { startDate, endDate, resource, action } = query;

    // Se data antiga, buscar também de archive
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const includeArchived = startDate && new Date(startDate) < cutoffDate;

    const [active, archived] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { /* ... */ },
      }),
      includeArchived
        ? this.prisma.archivedAuditLog.findMany({
            where: { /* ... */ },
          })
        : [],
    ]);

    return [...active, ...archived].sort((a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }
}
```

### Critérios de Conclusão

- [ ] ArchivedAuditLog table criada
- [ ] Cron job de archive rodando
- [ ] Cron job de delete rodando
- [ ] Query service busca em ambas tabelas
- [ ] Monitoramento de tamanho das tabelas

---

# FASE 2: ESCALABILIDADE

> **Objetivo**: Sistema aguenta 10x mais tráfego
> **Duração estimada**: 2 semanas
> **Prioridade**: 🟡 IMPORTANTE

---

## 2.1 - Otimização de Computed Fields

**Status**: ⏸️ Não iniciado
**Prioridade**: 🟡 IMPORTANTE
**Estimativa**: 3-4 dias
**Dependências**: Nenhuma

### Estratégia: Materialização com Invalidação Inteligente

#### Step 1: Schema Migration (1h)
```sql
-- Adicionar coluna para valores computados
ALTER TABLE "EntityData"
  ADD COLUMN "computedValues" JSONB DEFAULT '{}';

CREATE INDEX "EntityData_computedValues_idx"
  ON "EntityData" USING gin("computedValues");
```

#### Step 2: Computed Field Materializer (4h)
```typescript
// apps/api/src/modules/entity/computed-field-materializer.service.ts
@Injectable()
export class ComputedFieldMaterializerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly computedFieldService: ComputedFieldService,
  ) {}

  async materialize(
    entity: Entity,
    record: EntityData
  ): Promise<Record<string, unknown>> {
    const computedFields = entity.fields.filter(f =>
      ['formula', 'rollup', 'timer', 'sla-status'].includes(f.type)
    );

    if (computedFields.length === 0) {
      return {};
    }

    const computedValues: Record<string, unknown> = {};

    for (const field of computedFields) {
      const value = await this.computeField(field, record, entity);
      computedValues[field.key] = value;
    }

    // Salvar no banco
    await this.prisma.entityData.update({
      where: { id: record.id },
      data: { computedValues },
    });

    return computedValues;
  }

  private async computeField(
    field: EntityField,
    record: EntityData,
    entity: Entity
  ): Promise<unknown> {
    switch (field.type) {
      case 'formula':
        return this.computedFieldService.evaluateFormula(
          field.settings.formula,
          record.data as Record<string, unknown>
        );

      case 'rollup':
        return this.computedFieldService.evaluateRollup(
          field.settings.relatedEntity,
          field.settings.aggregation,
          record
        );

      case 'timer':
        return this.computedFieldService.calculateTimer(
          field.settings.startField,
          field.settings.endField,
          record.data as Record<string, unknown>
        );

      case 'sla-status':
        return this.computedFieldService.calculateSLAStatus(
          field.settings.deadline,
          record.data as Record<string, unknown>
        );

      default:
        return null;
    }
  }

  async invalidateAndRecompute(
    entitySlug: string,
    recordIds: string[]
  ): Promise<void> {
    const entity = await this.prisma.entity.findUnique({
      where: { slug: entitySlug },
      include: { fields: true },
    });

    if (!entity) return;

    const records = await this.prisma.entityData.findMany({
      where: { id: { in: recordIds } },
    });

    for (const record of records) {
      await this.materialize(entity, record);
    }
  }
}
```

#### Step 3: Invalidação Inteligente (2h)
```typescript
// apps/api/src/modules/data/data.service.ts
export class DataService {
  async update(id: string, entitySlug: string, dto: UpdateEntityDataDto) {
    // ... lógica de update

    // Identificar campos que invalidam computed fields
    const changedFields = Object.keys(dto.data);
    const affectedComputedFields = this.getAffectedComputedFields(
      entity,
      changedFields
    );

    if (affectedComputedFields.length > 0) {
      // Recomputar apenas campos afetados
      await this.materializer.invalidateAndRecompute(entitySlug, [id]);

      // Se tem rollups que dependem deste registro, recomputar pais
      await this.invalidateParentRollups(entity, updated);
    }

    return updated;
  }

  private getAffectedComputedFields(
    entity: Entity,
    changedFields: string[]
  ): EntityField[] {
    return entity.fields.filter(field => {
      if (field.type === 'formula') {
        // Checar se formula usa algum campo alterado
        const formula = field.settings.formula;
        return changedFields.some(f => formula.includes(f));
      }

      if (field.type === 'timer') {
        return changedFields.includes(field.settings.startField) ||
               changedFields.includes(field.settings.endField);
      }

      return false;
    });
  }

  private async invalidateParentRollups(
    entity: Entity,
    record: EntityData
  ): Promise<void> {
    // Buscar entidades que fazem rollup desta
    const relatedEntities = await this.prisma.entity.findMany({
      where: {
        tenantId: entity.tenantId,
        fields: {
          some: {
            type: 'rollup',
            settings: {
              path: ['relatedEntity'],
              equals: entity.slug,
            },
          },
        },
      },
      include: { fields: true },
    });

    for (const relatedEntity of relatedEntities) {
      // Encontrar registros pais
      const parentRecords = await this.findParentRecords(
        relatedEntity,
        record
      );

      // Recomputar rollups dos pais
      await this.materializer.invalidateAndRecompute(
        relatedEntity.slug,
        parentRecords.map(r => r.id)
      );
    }
  }
}
```

#### Step 4: Background Job para Recompute (2h)
```typescript
// apps/api/src/modules/entity/recompute-fields.job.ts
@Injectable()
export class RecomputeFieldsJob {
  constructor(
    private readonly materializer: ComputedFieldMaterializerService,
  ) {}

  @Cron('0 */6 * * *') // A cada 6 horas
  async recomputeTimerFields() {
    // Recomputar apenas timers (que mudam com o tempo)
    const entitiesWithTimers = await this.prisma.entity.findMany({
      where: {
        fields: {
          some: { type: 'timer' },
        },
      },
      include: { fields: true },
    });

    for (const entity of entitiesWithTimers) {
      const records = await this.prisma.entityData.findMany({
        where: { entityId: entity.id },
        select: { id: true },
      });

      // Processar em lotes de 100
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        await this.materializer.invalidateAndRecompute(
          entity.slug,
          batch.map(r => r.id)
        );
      }
    }
  }
}
```

### Critérios de Conclusão

- [ ] Computed values materializados no banco
- [ ] Invalidação inteligente (apenas campos afetados)
- [ ] Rollup parents invalidados corretamente
- [ ] Background job para timers
- [ ] Performance: GET 10x mais rápido
- [ ] Testes de invalidação passando

---

## 2.2 - Paginação Cursor Completa

**Status**: ⏸️ Não iniciado
**Prioridade**: 🟡 IMPORTANTE
**Estimativa**: 2 dias
**Dependências**: Nenhuma

### Implementação Rápida

#### Endpoints a migrar:
1. `GET /users` ✅ (já tem offset, adicionar cursor)
2. `GET /entities` ✅
3. `GET /notifications` ✅
4. `GET /audit-logs` ✅
5. `GET /automations` ✅

#### Template (aplicar em cada endpoint):
```typescript
// Antes (offset):
async findAll(@Query() query: PaginationDto) {
  const { page = 1, limit = 20 } = query;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    this.prisma.user.findMany({ skip, take: limit }),
    this.prisma.user.count(),
  ]);

  return { data, meta: { page, limit, total } };
}

// Depois (cursor):
async findAll(@Query() query: CursorPaginationDto) {
  const { cursor, limit = 20 } = query;

  const data = await this.prisma.user.findMany({
    take: limit + 1, // +1 para detectar hasMore
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    orderBy: { createdAt: 'desc' },
  });

  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, -1) : data;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { data: items, meta: { nextCursor, hasMore } };
}
```

### Critérios de Conclusão

- [ ] 5 endpoints migrados para cursor
- [ ] Frontend atualizado (infinite scroll)
- [ ] Performance: tabelas com 100k+ registros < 100ms

---

## 2.3 - Importação em Background

**Status**: ⏸️ Não iniciado
**Prioridade**: 🟡 IMPORTANTE
**Estimativa**: 3-4 dias
**Dependências**: Bull (Fase 1.1)

### Fluxo Completo

```
1. Upload XLSX → /data/:slug/import/upload
2. Parse header → Retorna preview (primeiras 10 linhas)
3. User confirma mapeamento
4. POST /data/:slug/import/process → Job criado
5. Backend processa em chunks de 100
6. WebSocket notifica progresso (10%, 20%, ...)
7. Ao finalizar: Download relatório de erros
```

### Implementação

#### Step 1: Upload Endpoint (1h)
```typescript
@Post(':entitySlug/import/upload')
@UseInterceptors(FileInterceptor('file'))
async uploadImportFile(
  @Param('entitySlug') entitySlug: string,
  @UploadedFile() file: Express.Multer.File,
  @CurrentUser() user: CurrentUser
) {
  // Salvar arquivo temporariamente
  const tempPath = `/tmp/imports/${uuid()}.xlsx`;
  await fs.writeFile(tempPath, file.buffer);

  // Parse header
  const workbook = XLSX.read(file.buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const preview = rows.slice(0, 10);
  const headers = Object.keys(rows[0]);

  return {
    importId: path.basename(tempPath, '.xlsx'),
    headers,
    preview,
    totalRows: rows.length,
  };
}
```

#### Step 2: Process Job (3h)
```typescript
@Post(':entitySlug/import/process')
async processImport(
  @Param('entitySlug') entitySlug: string,
  @Body() dto: ProcessImportDto,
  @CurrentUser() user: CurrentUser
) {
  const { importId, fieldMapping } = dto;

  // Adicionar job à fila
  const job = await this.importQueue.add('process-import', {
    importId,
    entitySlug,
    fieldMapping,
    userId: user.sub,
    tenantId: user.tenantId,
  });

  return { jobId: job.id };
}

// Processor
@Processor('import-queue')
export class ImportProcessor {
  @Process('process-import')
  async handleImport(job: Job) {
    const { importId, entitySlug, fieldMapping, userId, tenantId } = job.data;

    // Carregar arquivo
    const filePath = `/tmp/imports/${importId}.xlsx`;
    const workbook = XLSX.readFile(filePath);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const errors: ImportError[] = [];
    let imported = 0;

    // Processar em chunks
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);

      for (const row of chunk) {
        try {
          // Mapear campos
          const data = this.mapFields(row, fieldMapping);

          // Validar
          await this.validateData(data, entity);

          // Criar
          await this.dataService.create(entitySlug, { data }, { sub: userId, tenantId });

          imported++;
        } catch (error) {
          errors.push({
            row: i + rows.indexOf(row) + 2, // +2 (header + 1-indexed)
            data: row,
            error: error.message,
          });
        }
      }

      // Atualizar progresso
      const progress = Math.round((i / rows.length) * 100);
      await job.progress(progress);

      // Notificar via WebSocket
      this.notificationGateway.emitToUser(userId, 'import-progress', {
        importId,
        progress,
        imported,
        errors: errors.length,
      });
    }

    // Gerar relatório
    const reportPath = await this.generateErrorReport(errors);

    // Notificar conclusão
    this.notificationGateway.emitToUser(userId, 'import-complete', {
      importId,
      imported,
      errors: errors.length,
      reportUrl: reportPath,
    });

    // Limpar arquivo temporário
    await fs.unlink(filePath);

    return { imported, errors: errors.length };
  }
}
```

#### Step 3: Frontend Progress (2h)
```tsx
// apps/web-admin/src/components/data/import-progress-modal.tsx
export function ImportProgressModal({ importId, onClose }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'uploading' | 'processing' | 'complete' | 'error'>('processing');

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token: getAccessToken() },
    });

    socket.on('import-progress', (data) => {
      if (data.importId === importId) {
        setProgress(data.progress);
      }
    });

    socket.on('import-complete', (data) => {
      if (data.importId === importId) {
        setStatus('complete');
        toast.success(`Importados ${data.imported} registros!`);

        if (data.errors > 0) {
          toast.warning(`${data.errors} erros - baixe o relatório`);
        }
      }
    });

    return () => socket.disconnect();
  }, [importId]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importando dados...</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Progress value={progress} />
          <p className="text-center text-sm text-muted-foreground">
            {progress}% concluído
          </p>

          {status === 'complete' && (
            <div className="flex gap-2">
              <Button onClick={onClose}>Fechar</Button>
              <Button variant="outline" onClick={() => downloadReport()}>
                Baixar Relatório de Erros
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Critérios de Conclusão

- [ ] Upload + preview funcionando
- [ ] Processamento em background via Bull
- [ ] Progress tracking via WebSocket
- [ ] Relatório de erros gerado
- [ ] Frontend mostra progresso em tempo real
- [ ] Imports de 10k+ linhas não travam

---

# FASE 3: FEATURES CORE

> **Objetivo**: Funcionalidades que agregam valor direto
> **Duração estimada**: 3-4 semanas
> **Prioridade**: 🟢 FEATURES

---

## 3.1 - API Pública Documentada

**Status**: ⏸️ Não iniciado
**Prioridade**: 🔥 ALTA (para growth)
**Estimativa**: 5-6 dias
**Dependências**: Nenhuma

### Estrutura

```
/api/public/v1/
├── /auth/api-keys          # CRUD de API keys
├── /data/:entitySlug       # CRUD via API key
├── /webhooks/subscribe     # Self-service webhooks
└── /docs                   # Swagger UI
```

### Implementação

#### Step 1: API Key Model (1h)
```prisma
model ApiKey {
  id          String   @id @default(cuid())
  name        String
  key         String   @unique
  tenantId    String
  userId      String
  scopes      String[] // ['data:read', 'data:write', 'webhooks:manage']
  rateLimit   Int      @default(100) // requests/min
  expiresAt   DateTime?
  lastUsedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  user        User     @relation(fields: [userId], references: [id])

  @@index([tenantId])
  @@index([key])
}
```

#### Step 2: API Key Guard (2h)
```typescript
// apps/api/src/common/guards/api-key.guard.ts
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key obrigatória');
    }

    // Verificar cache primeiro
    const cacheKey = `api-key:${apiKey}`;
    let keyData = await this.redis.get<ApiKey>(cacheKey);

    if (!keyData) {
      // Cache miss - buscar do banco
      keyData = await this.prisma.apiKey.findUnique({
        where: { key: apiKey },
        include: { tenant: true, user: true },
      });

      if (!keyData) {
        throw new UnauthorizedException('API key inválida');
      }

      // Cachear por 5 minutos
      await this.redis.set(cacheKey, keyData, 300);
    }

    // Verificar expiração
    if (keyData.expiresAt && new Date() > keyData.expiresAt) {
      throw new UnauthorizedException('API key expirada');
    }

    // Rate limiting
    await this.checkRateLimit(apiKey, keyData.rateLimit);

    // Atualizar lastUsedAt (async)
    this.prisma.apiKey.update({
      where: { id: keyData.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {}); // Fire-and-forget

    // Injetar user no request
    request.user = {
      sub: keyData.userId,
      tenantId: keyData.tenantId,
      roleType: keyData.user.customRole.roleType,
      apiKey: true,
      scopes: keyData.scopes,
    };

    return true;
  }

  private async checkRateLimit(apiKey: string, limit: number): Promise<void> {
    const key = `rate-limit:api-key:${apiKey}`;
    const current = await this.redis.client.incr(key);

    if (current === 1) {
      await this.redis.client.expire(key, 60); // 1 minuto
    }

    if (current > limit) {
      throw new TooManyRequestsException(
        `Rate limit excedido (${limit} req/min)`
      );
    }
  }
}
```

#### Step 3: Public Data Controller (3h)
```typescript
// apps/api/src/modules/public-api/public-data.controller.ts
@Controller('public/v1/data')
@UseGuards(ApiKeyGuard)
@ApiTags('Public API - Data')
export class PublicDataController {
  constructor(private readonly dataService: DataService) {}

  @Get(':entitySlug')
  @ApiOperation({ summary: 'List records' })
  @RequireScope('data:read')
  async findAll(
    @Param('entitySlug') entitySlug: string,
    @Query() query: PublicPaginationDto,
    @CurrentUser() user: CurrentUser
  ) {
    return this.dataService.findAll(entitySlug, query, user);
  }

  @Get(':entitySlug/:id')
  @ApiOperation({ summary: 'Get record by ID' })
  @RequireScope('data:read')
  async findOne(
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @CurrentUser() user: CurrentUser
  ) {
    return this.dataService.findOne(entitySlug, id, user);
  }

  @Post(':entitySlug')
  @ApiOperation({ summary: 'Create record' })
  @RequireScope('data:write')
  async create(
    @Param('entitySlug') entitySlug: string,
    @Body() dto: CreateEntityDataDto,
    @CurrentUser() user: CurrentUser
  ) {
    return this.dataService.create(entitySlug, dto, user);
  }

  @Patch(':entitySlug/:id')
  @ApiOperation({ summary: 'Update record' })
  @RequireScope('data:write')
  async update(
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @Body() dto: UpdateEntityDataDto,
    @CurrentUser() user: CurrentUser
  ) {
    return this.dataService.update(id, entitySlug, dto, user);
  }

  @Delete(':entitySlug/:id')
  @ApiOperation({ summary: 'Delete record' })
  @RequireScope('data:delete')
  async remove(
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @CurrentUser() user: CurrentUser
  ) {
    return this.dataService.remove(id, entitySlug, user);
  }
}
```

#### Step 4: Swagger Documentation (2h)
```typescript
// apps/api/src/main.ts
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const publicApiConfig = new DocumentBuilder()
  .setTitle('CRM Builder - Public API')
  .setDescription('API pública para integração externa')
  .setVersion('1.0')
  .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
  .addTag('Public API - Data')
  .addTag('Public API - Webhooks')
  .build();

const publicDocument = SwaggerModule.createDocument(app, publicApiConfig, {
  include: [PublicApiModule],
});

SwaggerModule.setup('api/public/docs', app, publicDocument);
```

#### Step 5: Frontend - API Key Management (4h)
```tsx
// apps/web-admin/src/app/(dashboard)/settings/api-keys/page.tsx
export default function ApiKeysPage() {
  const { data: apiKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/api-keys'),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateApiKeyDto) => api.post('/api-keys', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API Key criada!');
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova API Key
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Scopes</TableHead>
            <TableHead>Rate Limit</TableHead>
            <TableHead>Último Uso</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apiKeys?.map(key => (
            <TableRow key={key.id}>
              <TableCell>{key.name}</TableCell>
              <TableCell>
                <code className="text-xs">{maskApiKey(key.key)}</code>
                <Button size="icon" variant="ghost" onClick={() => copyKey(key.key)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {key.scopes.map(scope => (
                    <Badge key={scope} variant="outline">{scope}</Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>{key.rateLimit} req/min</TableCell>
              <TableCell>
                {key.lastUsedAt ? formatDistanceToNow(key.lastUsedAt) : 'Nunca'}
              </TableCell>
              <TableCell>
                <Button size="sm" variant="destructive" onClick={() => revokeKey(key.id)}>
                  Revogar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {showCreate && (
        <CreateApiKeyDialog
          onClose={() => setShowCreate(false)}
          onCreate={(data) => createMutation.mutate(data)}
        />
      )}
    </div>
  );
}
```

### Documentação de Exemplo

```markdown
# CRM Builder - Public API

## Autenticação

Todas as requisições devem incluir o header:
```
X-API-Key: your-api-key-here
```

## Rate Limiting

- Default: 100 req/min por API key
- Response headers:
  - `X-RateLimit-Limit`: Limite total
  - `X-RateLimit-Remaining`: Requests restantes
  - `X-RateLimit-Reset`: Timestamp do reset

## Endpoints

### Listar Registros

```bash
GET /api/public/v1/data/:entitySlug

Query params:
- limit (default: 20, max: 100)
- cursor (cursor-based pagination)
- filters (JSON stringified)
- search

Response:
{
  "data": [...],
  "meta": {
    "nextCursor": "abc123",
    "hasMore": true
  }
}
```

### Criar Registro

```bash
POST /api/public/v1/data/:entitySlug

Body:
{
  "data": {
    "name": "João Silva",
    "email": "joao@example.com"
  }
}

Response:
{
  "id": "record-123",
  "data": {...},
  "createdAt": "2026-04-09T..."
}
```

## Erros

```json
{
  "statusCode": 401,
  "message": "API key inválida",
  "error": "Unauthorized"
}
```

## Exemplos

### JavaScript/Node.js

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'https://your-crm.com/api/public/v1',
  headers: {
    'X-API-Key': 'your-key-here',
  },
});

// Listar leads
const leads = await api.get('/data/leads');

// Criar lead
const newLead = await api.post('/data/leads', {
  data: {
    name: 'João Silva',
    email: 'joao@example.com',
    status: 'new',
  },
});
```

### Python

```python
import requests

API_URL = 'https://your-crm.com/api/public/v1'
API_KEY = 'your-key-here'

headers = {'X-API-Key': API_KEY}

# Listar leads
response = requests.get(f'{API_URL}/data/leads', headers=headers)
leads = response.json()

# Criar lead
new_lead = requests.post(
    f'{API_URL}/data/leads',
    headers=headers,
    json={'data': {'name': 'João Silva', 'email': 'joao@example.com'}}
)
```

### cURL

```bash
# Listar
curl -H "X-API-Key: your-key-here" \
  https://your-crm.com/api/public/v1/data/leads

# Criar
curl -X POST \
  -H "X-API-Key: your-key-here" \
  -H "Content-Type: application/json" \
  -d '{"data":{"name":"João Silva","email":"joao@example.com"}}' \
  https://your-crm.com/api/public/v1/data/leads
```
```

### Critérios de Conclusão

- [ ] ApiKey model + migrations
- [ ] API Key guard com rate limiting
- [ ] Public data controller funcionando
- [ ] Swagger docs publicadas
- [ ] Frontend de gerenciamento
- [ ] Documentação completa com exemplos
- [ ] Rate limiting em 100 req/min
- [ ] Cache de API keys (Redis)

---

## 3.2 - Versionamento de Registros

**Status**: ⏸️ Não iniciado
**Prioridade**: 🟡 MÉDIA
**Estimativa**: 4-5 dias
**Dependências**: Nenhuma

### Modelo de Dados

```prisma
model EntityDataVersion {
  id            String   @id @default(cuid())
  entityDataId  String
  version       Int      // 1, 2, 3, ...
  data          Json     // Snapshot completo
  diff          Json?    // Apenas campos alterados (economiza espaço)
  changedBy     String   // userId
  changedAt     DateTime @default(now())
  changeType    String   // 'create' | 'update' | 'delete' | 'restore'
  metadata      Json?    // IP, user agent, etc

  entityData    EntityData @relation(fields: [entityDataId], references: [id], onDelete: Cascade)
  user          User       @relation(fields: [changedBy], references: [id])

  @@unique([entityDataId, version])
  @@index([entityDataId])
  @@index([changedAt])
}
```

### Implementação

#### Step 1: Version Tracker Service (3h)
```typescript
// apps/api/src/modules/data/version-tracker.service.ts
@Injectable()
export class VersionTrackerService {
  constructor(private readonly prisma: PrismaService) {}

  async createVersion(
    entityDataId: string,
    newData: Record<string, unknown>,
    previousData: Record<string, unknown> | null,
    changeType: 'create' | 'update' | 'delete' | 'restore',
    userId: string
  ): Promise<EntityDataVersion> {
    // Buscar última versão
    const lastVersion = await this.prisma.entityDataVersion.findFirst({
      where: { entityDataId },
      orderBy: { version: 'desc' },
    });

    const version = (lastVersion?.version || 0) + 1;

    // Calcular diff (apenas campos alterados)
    const diff = previousData ? this.calculateDiff(previousData, newData) : null;

    return this.prisma.entityDataVersion.create({
      data: {
        entityDataId,
        version,
        data: newData,
        diff,
        changeType,
        changedBy: userId,
      },
    });
  }

  private calculateDiff(
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>
  ): Record<string, { old: unknown; new: unknown }> {
    const diff: Record<string, { old: unknown; new: unknown }> = {};

    // Checar campos alterados
    for (const key of Object.keys(newData)) {
      if (!isEqual(oldData[key], newData[key])) {
        diff[key] = {
          old: oldData[key],
          new: newData[key],
        };
      }
    }

    // Checar campos removidos
    for (const key of Object.keys(oldData)) {
      if (!(key in newData)) {
        diff[key] = {
          old: oldData[key],
          new: undefined,
        };
      }
    }

    return diff;
  }

  async getVersionHistory(entityDataId: string): Promise<EntityDataVersion[]> {
    return this.prisma.entityDataVersion.findMany({
      where: { entityDataId },
      orderBy: { version: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async restoreVersion(
    entityDataId: string,
    targetVersion: number,
    userId: string
  ): Promise<EntityData> {
    const version = await this.prisma.entityDataVersion.findUnique({
      where: {
        entityDataId_version: {
          entityDataId,
          version: targetVersion,
        },
      },
    });

    if (!version) {
      throw new NotFoundException('Versão não encontrada');
    }

    // Buscar registro atual
    const current = await this.prisma.entityData.findUnique({
      where: { id: entityDataId },
    });

    if (!current) {
      throw new NotFoundException('Registro não encontrado');
    }

    // Atualizar com dados da versão
    const restored = await this.prisma.entityData.update({
      where: { id: entityDataId },
      data: { data: version.data },
    });

    // Criar nova versão marcando como restore
    await this.createVersion(
      entityDataId,
      version.data as Record<string, unknown>,
      current.data as Record<string, unknown>,
      'restore',
      userId
    );

    return restored;
  }
}
```

#### Step 2: Integrar no DataService (1h)
```typescript
// apps/api/src/modules/data/data.service.ts
export class DataService {
  constructor(
    private readonly versionTracker: VersionTrackerService,
    // ... outros
  ) {}

  async create(entitySlug: string, dto: CreateEntityDataDto, user: CurrentUser) {
    const created = await this.prisma.entityData.create({
      data: { /* ... */ },
    });

    // Criar versão inicial (v1)
    await this.versionTracker.createVersion(
      created.id,
      created.data as Record<string, unknown>,
      null,
      'create',
      user.sub
    );

    return created;
  }

  async update(id: string, entitySlug: string, dto: UpdateEntityDataDto, user: CurrentUser) {
    const existing = await this.prisma.entityData.findUnique({ where: { id } });

    const updated = await this.prisma.entityData.update({
      where: { id },
      data: { /* ... */ },
    });

    // Criar nova versão
    await this.versionTracker.createVersion(
      updated.id,
      updated.data as Record<string, unknown>,
      existing.data as Record<string, unknown>,
      'update',
      user.sub
    );

    return updated;
  }
}
```

#### Step 3: Version History Endpoint (1h)
```typescript
// apps/api/src/modules/data/data.controller.ts
@Controller('data')
export class DataController {
  @Get(':entitySlug/:id/versions')
  @ApiOperation({ summary: 'Get version history' })
  async getVersions(
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @CurrentUser() user: CurrentUser
  ) {
    // Validar acesso ao registro
    const record = await this.dataService.findOne(entitySlug, id, user);

    return this.versionTracker.getVersionHistory(id);
  }

  @Post(':entitySlug/:id/restore/:version')
  @ApiOperation({ summary: 'Restore to version' })
  async restoreVersion(
    @Param('entitySlug') entitySlug: string,
    @Param('id') id: string,
    @Param('version') version: number,
    @CurrentUser() user: CurrentUser
  ) {
    // Validar permissão de update
    // ...

    return this.versionTracker.restoreVersion(id, version, user.sub);
  }
}
```

#### Step 4: Frontend - Version Timeline (6h)
```tsx
// apps/web-admin/src/components/data/version-history-modal.tsx
export function VersionHistoryModal({ recordId, entitySlug }) {
  const { data: versions } = useQuery({
    queryKey: ['versions', recordId],
    queryFn: () => api.get(`/data/${entitySlug}/${recordId}/versions`),
  });

  const restoreMutation = useMutation({
    mutationFn: (version: number) =>
      api.post(`/data/${entitySlug}/${recordId}/restore/${version}`),
    onSuccess: () => {
      toast.success('Versão restaurada!');
      queryClient.invalidateQueries({ queryKey: ['entity-data', entitySlug] });
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Histórico de Versões</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[600px]">
          <div className="space-y-4">
            {versions?.map((version, index) => (
              <Card key={version.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">
                        Versão {version.version}
                        {index === 0 && (
                          <Badge className="ml-2" variant="default">Atual</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {version.user.name} • {formatDistanceToNow(version.changedAt, { addSuffix: true })}
                      </CardDescription>
                    </div>

                    {index !== 0 && (
                      <Button
                        size="sm"
                        onClick={() => restoreMutation.mutate(version.version)}
                      >
                        Restaurar
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  {version.diff && Object.keys(version.diff).length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Campos alterados:</p>
                      {Object.entries(version.diff).map(([key, change]) => (
                        <div key={key} className="bg-muted p-2 rounded text-sm">
                          <div className="font-medium">{key}</div>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div>
                              <span className="text-red-600">- {JSON.stringify(change.old)}</span>
                            </div>
                            <div>
                              <span className="text-green-600">+ {JSON.stringify(change.new)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {version.changeType === 'create' && 'Registro criado'}
                      {version.changeType === 'restore' && 'Versão restaurada'}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
```

### Critérios de Conclusão

- [ ] EntityDataVersion model + migrations
- [ ] Version tracker service implementado
- [ ] Diff calculation otimizada
- [ ] Create/Update criam versões automaticamente
- [ ] Endpoint de histórico funcionando
- [ ] Restore funcionando
- [ ] Frontend mostra timeline visual
- [ ] Diff mostra apenas campos alterados

---

## 3.3 - Templates de Email Visual

Ver implementação completa em seção dedicada...

## 3.4 - Relatórios Customizados

Ver implementação completa em seção dedicada...

---

# FASE 4: INTEGRAÇÕES

> **Objetivo**: Conectar com ecossistema externo
> **Duração estimada**: 3-4 semanas
> **Prioridade**: 🔥 ALTA (growth)

---

## 4.1 - Zapier Integration

**Status**: ⏸️ Não iniciado
**Prioridade**: 🔥 CRÍTICA (10x casos de uso)
**Estimativa**: 7-10 dias
**Dependências**: API Pública (Fase 3.1)

### O que criar

1. **Triggers** (quando algo acontece no CRM)
   - New Record Created
   - Record Updated
   - Record Deleted
   - Status Changed
   - Field Value Changed

2. **Actions** (fazer algo no CRM)
   - Create Record
   - Update Record
   - Find Record
   - Find or Create Record

3. **Searches** (buscar dados)
   - Find Record by ID
   - Find Record by Field
   - Find Latest Record

### Arquitetura Zapier

```
Zapier Platform
├── authentication.js    # OAuth2 ou API Key
├── triggers/
│   ├── new_record.js
│   ├── updated_record.js
│   └── status_changed.js
├── creates/
│   ├── create_record.js
│   ├── update_record.js
│   └── find_or_create.js
└── searches/
    ├── find_record.js
    └── find_latest.js
```

### Implementação

#### Step 1: Zapier CLI Setup (1h)
```bash
npm install -g zapier-platform-cli
zapier login
zapier init crm-builder --template=minimal
cd crm-builder
```

#### Step 2: Authentication (2h)
```javascript
// authentication.js
module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'apiKey',
      label: 'API Key',
      required: true,
      type: 'string',
      helpText: 'Get your API key from Settings > API Keys',
    },
    {
      key: 'subdomain',
      label: 'Subdomain',
      required: true,
      type: 'string',
      helpText: 'Your CRM subdomain (e.g., company.crm.com)',
    },
  ],
  test: {
    url: 'https://{{bundle.authData.subdomain}}/api/public/v1/auth/validate',
    headers: {
      'X-API-Key': '{{bundle.authData.apiKey}}',
    },
  },
  connectionLabel: '{{user.name}}',
};
```

#### Step 3: Trigger - New Record (3h)
```javascript
// triggers/new_record.js
const perform = async (z, bundle) => {
  const response = await z.request({
    url: `https://${bundle.authData.subdomain}/api/public/v1/data/${bundle.inputData.entitySlug}`,
    params: {
      limit: 100,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    },
  });

  return response.data.data;
};

const performList = async (z, bundle) => {
  // Zapier faz polling a cada 5-15 minutos
  const response = await z.request({
    url: `https://${bundle.authData.subdomain}/api/public/v1/data/${bundle.inputData.entitySlug}`,
    params: {
      limit: 100,
      createdAfter: bundle.meta.page ? bundle.meta.page : new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
  });

  return response.data.data;
};

module.exports = {
  key: 'new_record',
  noun: 'Record',
  display: {
    label: 'New Record',
    description: 'Triggers when a new record is created in an entity.',
  },
  operation: {
    inputFields: [
      {
        key: 'entitySlug',
        label: 'Entity',
        required: true,
        dynamic: 'entity.id.name', // Dropdown dinâmico
      },
    ],
    perform: performList,
    sample: {
      id: 'record-123',
      data: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      createdAt: '2026-04-09T12:00:00Z',
    },
  },
};
```

#### Step 4: Action - Create Record (3h)
```javascript
// creates/create_record.js
const perform = async (z, bundle) => {
  const response = await z.request({
    method: 'POST',
    url: `https://${bundle.authData.subdomain}/api/public/v1/data/${bundle.inputData.entitySlug}`,
    body: {
      data: bundle.inputData,
    },
  });

  return response.data;
};

module.exports = {
  key: 'create_record',
  noun: 'Record',
  display: {
    label: 'Create Record',
    description: 'Creates a new record in an entity.',
  },
  operation: {
    inputFields: async (z, bundle) => {
      // Buscar campos da entidade dinamicamente
      const response = await z.request({
        url: `https://${bundle.authData.subdomain}/api/public/v1/entities/${bundle.inputData.entitySlug}`,
      });

      const entity = response.data;

      // Converter campos da entidade em input fields do Zapier
      return entity.fields.map(field => ({
        key: `data__${field.key}`,
        label: field.label,
        type: getZapierType(field.type), // text, number, boolean, etc
        required: field.required,
        helpText: field.helpText,
      }));
    },
    perform,
    sample: {
      id: 'record-456',
      data: {
        name: 'Jane Doe',
        email: 'jane@example.com',
      },
      createdAt: '2026-04-09T12:30:00Z',
    },
  },
};

function getZapierType(crmFieldType) {
  const typeMap = {
    text: 'string',
    email: 'string',
    number: 'number',
    boolean: 'boolean',
    date: 'datetime',
    select: 'string',
  };
  return typeMap[crmFieldType] || 'string';
}
```

#### Step 5: Dynamic Dropdowns (2h)
```javascript
// triggers/entity.js (helper para dropdown)
const getEntityList = async (z, bundle) => {
  const response = await z.request({
    url: `https://${bundle.authData.subdomain}/api/public/v1/entities`,
  });

  return response.data.data.map(entity => ({
    id: entity.slug,
    name: entity.name,
  }));
};

module.exports = {
  key: 'entity',
  noun: 'Entity',
  display: {
    label: 'Get Entities',
    description: 'Hidden trigger for populating entity dropdowns',
    hidden: true,
  },
  operation: {
    perform: getEntityList,
  },
};
```

#### Step 6: Webhooks (Real-time triggers) (4h)
```javascript
// triggers/new_record_webhook.js
const subscribeHook = async (z, bundle) => {
  // Criar webhook no CRM
  const response = await z.request({
    method: 'POST',
    url: `https://${bundle.authData.subdomain}/api/public/v1/webhooks`,
    body: {
      url: bundle.targetUrl, // URL que Zapier vai receber
      entitySlug: bundle.inputData.entitySlug,
      events: ['created'],
    },
  });

  return response.data;
};

const unsubscribeHook = async (z, bundle) => {
  // Deletar webhook
  await z.request({
    method: 'DELETE',
    url: `https://${bundle.authData.subdomain}/api/public/v1/webhooks/${bundle.subscribeData.id}`,
  });
};

const perform = async (z, bundle) => {
  // Zapier recebe payload do webhook
  return [bundle.cleanedRequest]; // Deve ser array
};

module.exports = {
  key: 'new_record_webhook',
  noun: 'Record',
  display: {
    label: 'New Record (Instant)',
    description: 'Triggers instantly when a new record is created.',
  },
  operation: {
    type: 'hook',
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform,
    performList: () => [], // Fallback para setup inicial
    sample: {
      id: 'record-789',
      data: {
        name: 'Bob Smith',
        email: 'bob@example.com',
      },
      createdAt: '2026-04-09T13:00:00Z',
    },
  },
};
```

#### Step 7: Backend - Webhook Endpoint para Zapier (2h)
```typescript
// apps/api/src/modules/public-api/zapier-webhooks.controller.ts
@Controller('public/v1/webhooks')
@UseGuards(ApiKeyGuard)
export class ZapierWebhooksController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  async subscribe(@Body() dto: SubscribeWebhookDto, @CurrentUser() user: CurrentUser) {
    // Criar webhook que vai chamar Zapier
    return this.webhookService.create({
      url: dto.url, // URL do Zapier (ex: hooks.zapier.com/...)
      entitySlug: dto.entitySlug,
      events: dto.events, // ['created', 'updated', 'deleted']
      tenantId: user.tenantId,
      userId: user.sub,
    });
  }

  @Delete(':id')
  async unsubscribe(@Param('id') id: string, @CurrentUser() user: CurrentUser) {
    return this.webhookService.delete(id, user);
  }
}
```

#### Step 8: Deploy para Zapier (1h)
```bash
# Testar localmente
zapier test

# Deploy
zapier push

# Submeter para revisão do Zapier
zapier promote <version>

# (Zapier vai revisar e aprovar em ~1-2 semanas)
```

### Exemplos de Zaps

**Zap 1: Novo Lead → Slack**
```
Trigger: New Record (entity: leads)
Action: Send Channel Message (Slack)
Message: "Novo lead: {{name}} ({{email}})"
```

**Zap 2: Formulário Google → CRM**
```
Trigger: New Form Response (Google Forms)
Action: Create Record (CRM - entity: leads)
Map: Name → Name, Email → Email, etc
```

**Zap 3: Status Mudou → Enviar Email**
```
Trigger: Updated Record (entity: leads, field: status)
Filter: Status = "won"
Action: Send Email (Gmail)
To: {{email}}
Subject: "Parabéns! Seu lead foi aprovado"
```

### Critérios de Conclusão

- [ ] Zapier CLI configurado
- [ ] Authentication funcionando
- [ ] 3 triggers implementados (new, updated, deleted)
- [ ] 3 actions implementadas (create, update, find)
- [ ] Dynamic dropdowns funcionando
- [ ] Webhooks (instant triggers) funcionando
- [ ] Backend suporta webhooks do Zapier
- [ ] App publicado no Zapier (em beta)
- [ ] Documentação para usuários

---

## 4.2 - WhatsApp/Telegram Bot

Ver implementação completa em seção dedicada...

---

# FASE 5: UX & POLISH

> **Objetivo**: Melhorar experiência do usuário
> **Duração estimada**: 2 semanas
> **Prioridade**: 🟢 POLISH

---

## 5.1 - Command Palette (Cmd+K)

**Estimativa**: 2 dias

```tsx
// apps/web-admin/src/components/command-palette.tsx
import { Command } from 'cmdk';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Cmd+K para abrir
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <Command.Dialog open={open} onOpenChange={setOpen}>
      <Command.Input placeholder="Type a command or search..." />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>

        <Command.Group heading="Actions">
          <Command.Item onSelect={() => router.push('/users/new')}>
            <UserPlus className="mr-2 h-4 w-4" />
            Create User
          </Command.Item>
          <Command.Item onSelect={() => router.push('/data/leads/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Lead
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Navigation">
          <Command.Item onSelect={() => router.push('/dashboard')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Command.Item>
          <Command.Item onSelect={() => router.push('/users')}>
            <Users className="mr-2 h-4 w-4" />
            Users
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Search">
          {/* Busca dinâmica de registros */}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
```

---

## 5.2 - Dark Mode

**Estimativa**: 1 dia

```tsx
// apps/web-admin/src/components/theme-toggle.tsx
export function ThemeToggle() {
  const [theme, setTheme] = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 5.3 - Modo Offline no Frontend

**Estimativa**: 4-5 dias

Ver implementação com Service Worker + IndexedDB...

---

# FASE 6: TECH DEBT

> **Objetivo**: Limpar código legado
> **Duração estimada**: 2 semanas
> **Prioridade**: 🟢 CLEANUP

---

## 6.1 - Migrar Webhooks/ActionChains

**Estimativa**: 5-6 dias

Script de migração automática...

---

## 6.2 - Refatorar Data.Service

**Estimativa**: 3-4 dias

Extrair em múltiplos services...

---

## 6.3 - Testes E2E

**Estimativa**: 5-7 dias

Playwright setup com casos de uso principais...

---

# 📊 RESUMO DO ROADMAP

## Por Prioridade

### 🔴 CRÍTICO (Fazer primeiro)
1. Sistema de Fila para Automações (4d)
2. Cache de Permissions (2d)
3. Detecção de Loops Infinitos (2d)

### 🔥 ALTA (Growth)
4. API Pública Documentada (6d)
5. Zapier Integration (10d)

### 🟡 IMPORTANTE (Escalabilidade)
6. TTL em Audit Logs (2d)
7. Otimização de Computed Fields (4d)
8. Paginação Cursor Completa (2d)
9. Importação em Background (4d)

### 🟢 FEATURES
10. Versionamento de Registros (5d)
11. Relatórios Customizados (10d)
12. Templates de Email Visual (7d)

### 🟢 POLISH
13. Command Palette (2d)
14. Dark Mode (1d)
15. Modo Offline Frontend (5d)

### 🟢 CLEANUP
16. Migrar Webhooks/ActionChains (6d)
17. Refatorar Data.Service (4d)
18. Testes E2E (7d)

---

## Timeline Sugerida (3 meses)

### Mês 1: ESTABILIDADE + API
- Semana 1-2: Fila, Cache, Loops
- Semana 3: API Pública
- Semana 4: Zapier (início)

### Mês 2: ESCALABILIDADE + FEATURES
- Semana 1: Zapier (conclusão)
- Semana 2: Computed Fields + TTL + Paginação
- Semana 3-4: Import Background + Versionamento

### Mês 3: POLISH + CLEANUP
- Semana 1-2: Relatórios + Email Templates
- Semana 3: Command Palette + Dark Mode + Offline
- Semana 4: Testes E2E + Refatoração

---

**TOTAL**: ~120 dias de desenvolvimento (3 meses com 1 dev full-time)

Cada item é **independente** e pode ser implementado em qualquer ordem dentro da sua fase!
