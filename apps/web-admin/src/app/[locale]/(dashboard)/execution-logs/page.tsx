'use client';

import { useState, useMemo } from 'react';
import { Link } from '@/i18n/navigation';
import {
  Activity, Search, ArrowLeft, RefreshCw,
  ChevronDown, ChevronRight, X, Filter,
  CheckCircle, XCircle, Clock, AlertTriangle,
  Webhook, GitBranch, Calendar, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useExecutionLogs, useExecutionLogsStats } from '@/hooks/use-execution-logs';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ExecutionType = 'webhook' | 'action-chain' | 'scheduled-task' | 'api-execution';

const TYPE_CONFIG: Record<ExecutionType, { label: string; icon: typeof Webhook; color: string }> = {
  webhook: { label: 'Webhook', icon: Webhook, color: 'text-blue-600' },
  'action-chain': { label: 'Action Chain', icon: GitBranch, color: 'text-purple-600' },
  'scheduled-task': { label: 'Tarefa Agendada', icon: Calendar, color: 'text-orange-600' },
  'api-execution': { label: 'Custom API', icon: Zap, color: 'text-green-600' },
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; color: string; bgColor: string }> = {
  success: { label: 'Sucesso', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  error: { label: 'Erro', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  timeout: { label: 'Timeout', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
};

export default function ExecutionLogsPage() {
  const { isPlatformAdmin, isAdmin } = usePermissions();

  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [statsPeriod, setStatsPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const queryParams = useMemo(() => ({
    page,
    limit: 50,
    ...(typeFilter && { type: typeFilter as ExecutionType }),
    ...(statusFilter && { status: statusFilter as 'success' | 'error' | 'timeout' }),
  }), [page, typeFilter, statusFilter]);

  const { data, isLoading, refetch } = useExecutionLogs(queryParams);
  const { data: stats, isLoading: statsLoading } = useExecutionLogsStats(statsPeriod);

  const logs = data?.data ?? [];
  const meta = data?.meta;

  const hasFilters = !!(typeFilter || statusFilter);

  // Verificar permissao
  if (!isPlatformAdmin && !isAdmin) {
    return (
      <div className="max-w-3xl mx-auto mt-4 sm:mt-8 px-2 sm:px-0">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
            <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive mb-4" />
            <h2 className="text-lg sm:text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground text-center mb-4 text-sm sm:text-base px-2">
              Voce nao tem permissao para acessar esta pagina.
            </p>
            <Link href="/dashboard">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clearFilters = () => {
    setTypeFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Logs de Execucao</h1>
            <p className="text-sm text-muted-foreground">
              Monitore webhooks, action chains e tarefas agendadas
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totals?.total ?? 0}</div>
            <div className="flex items-center gap-2 mt-1">
              <Select value={statsPeriod} onValueChange={(v) => setStatsPeriod(v as typeof statsPeriod)}>
                <SelectTrigger className="h-6 text-xs w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Hoje</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Sucesso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.totals?.success ?? 0}</div>
            <div className="text-xs text-muted-foreground">
              {stats?.totals?.total ? Math.round((stats.totals.success / stats.totals.total) * 100) : 0}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Erros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.totals?.error ?? 0}</div>
            <div className="text-xs text-muted-foreground">
              {stats?.totals?.total ? Math.round((stats.totals.error / stats.totals.total) * 100) : 0}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Por Tipo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Webhooks</span>
              <span>{stats?.webhook?.total ?? 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Action Chains</span>
              <span>{stats?.actionChain?.total ?? 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Tarefas</span>
              <span>{stats?.scheduledTask?.total ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="webhook">Webhook</SelectItem>
            <SelectItem value="action-chain">Action Chain</SelectItem>
            <SelectItem value="scheduled-task">Tarefa Agendada</SelectItem>
            <SelectItem value="api-execution">Custom API</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="success">Sucesso</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
            <SelectItem value="timeout">Timeout</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Activity className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma execucao encontrada</p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                const typeConfig = TYPE_CONFIG[log.type as ExecutionType];
                const statusConfig = STATUS_CONFIG[log.status] || STATUS_CONFIG.error;
                const TypeIcon = typeConfig?.icon || Zap;
                const StatusIcon = statusConfig.icon;
                const isExpanded = expandedRow === log.id;

                return (
                  <div key={log.id}>
                    <div
                      className={cn(
                        'flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors',
                        isExpanded && 'bg-muted/30'
                      )}
                      onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                    >
                      {/* Type Icon */}
                      <TypeIcon className={cn('h-5 w-5 flex-shrink-0', typeConfig?.color || 'text-gray-600')} />

                      {/* Name & Type */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{log.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {typeConfig?.label || log.type}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <Badge
                        variant="secondary"
                        className={cn('flex items-center gap-1', statusConfig.bgColor, statusConfig.color)}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>

                      {/* Duration */}
                      <div className="text-sm text-muted-foreground w-16 text-right">
                        {formatDuration(log.duration)}
                      </div>

                      {/* Time */}
                      <div className="text-sm text-muted-foreground w-32 text-right hidden md:block">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: ptBR })}
                      </div>

                      {/* Expand Arrow */}
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-muted/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {/* Basic Info */}
                          <div className="space-y-2">
                            <div>
                              <span className="text-muted-foreground">ID: </span>
                              <span className="font-mono text-xs">{log.id}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Data: </span>
                              <span>{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Duracao: </span>
                              <span>{formatDuration(log.duration)}</span>
                            </div>
                          </div>

                          {/* Error Message */}
                          {log.error && (
                            <div>
                              <div className="text-muted-foreground mb-1">Erro:</div>
                              <div className="text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded text-xs font-mono">
                                {log.error}
                              </div>
                            </div>
                          )}

                          {/* Metadata */}
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className="col-span-full">
                              <div className="text-muted-foreground mb-1">Metadata:</div>
                              <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-40">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            Pagina {page} de {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page === meta.totalPages}
          >
            Proxima
          </Button>
        </div>
      )}
    </div>
  );
}
