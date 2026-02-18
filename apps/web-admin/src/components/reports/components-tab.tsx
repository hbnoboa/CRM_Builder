'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  Hash,
  Table,
  Gauge,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Database,
} from 'lucide-react';
import { useEntities } from '@/hooks/use-entities';
import type { ReportComponent, ComponentType, ComponentWidth, Aggregation } from '@/services/reports.service';

interface ComponentsTabProps {
  components: ReportComponent[];
  onChange: (components: ReportComponent[]) => void;
}

const COMPONENT_TYPES = [
  { value: 'stats-card' as ComponentType, label: 'Card de Estatistica', icon: Hash, bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
  { value: 'bar-chart' as ComponentType, label: 'Grafico de Barras', icon: BarChart3, bgColor: 'bg-green-100', textColor: 'text-green-700' },
  { value: 'line-chart' as ComponentType, label: 'Grafico de Linha', icon: LineChart, bgColor: 'bg-purple-100', textColor: 'text-purple-700' },
  { value: 'pie-chart' as ComponentType, label: 'Grafico de Pizza', icon: PieChart, bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
  { value: 'table' as ComponentType, label: 'Tabela', icon: Table, bgColor: 'bg-gray-100', textColor: 'text-gray-700' },
  { value: 'kpi' as ComponentType, label: 'KPI', icon: TrendingUp, bgColor: 'bg-indigo-100', textColor: 'text-indigo-700' },
  { value: 'gauge' as ComponentType, label: 'Medidor', icon: Gauge, bgColor: 'bg-rose-100', textColor: 'text-rose-700' },
];

const DATE_PRESETS = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'quarter', label: 'Este trimestre' },
  { value: 'year', label: 'Este ano' },
];

const AGGREGATIONS: { value: Aggregation; label: string }[] = [
  { value: 'count', label: 'Contagem' },
  { value: 'sum', label: 'Soma' },
  { value: 'avg', label: 'Media' },
  { value: 'min', label: 'Minimo' },
  { value: 'max', label: 'Maximo' },
];

export function ComponentsTab({ components, onChange }: ComponentsTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: entitiesData } = useEntities();
  const entities = entitiesData?.data || [];

  const addComponent = (type: ComponentType) => {
    const typeInfo = COMPONENT_TYPES.find((t) => t.value === type)!;
    const newComponent: ReportComponent = {
      id: `comp_${Date.now()}`,
      type,
      order: components.length,
      width: 'half',
      title: typeInfo.label,
      dataSource: {
        entity: '',
        dateRange: { preset: 'month' },
      },
      config: {
        aggregation: 'count',
      },
    };
    onChange([...components, newComponent]);
    setExpandedId(newComponent.id);
  };

  const updateComponent = (id: string, updates: Partial<ReportComponent>) => {
    onChange(components.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeComponent = (id: string) => {
    onChange(components.filter((c) => c.id !== id));
  };

  const moveComponent = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= components.length) return;

    const newComponents = [...components];
    [newComponents[index], newComponents[newIndex]] = [newComponents[newIndex], newComponents[index]];
    newComponents.forEach((c, i) => (c.order = i));
    onChange(newComponents);
  };

  const getTypeInfo = (type: ComponentType) => COMPONENT_TYPES.find((t) => t.value === type)!;

  const getEntityFields = (entitySlug: string) => {
    const entity = entities.find((e) => e.slug === entitySlug);
    return entity?.fields || [];
  };

  return (
    <div className="space-y-4">
      {/* Botoes para adicionar */}
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Componente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {COMPONENT_TYPES.map((type) => (
              <Button
                key={type.value}
                variant="outline"
                className="flex flex-col h-20 gap-1"
                onClick={() => addComponent(type.value)}
              >
                <type.icon className="h-5 w-5" />
                <span className="text-xs text-center">{type.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista de componentes */}
      {components.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum componente adicionado ainda</p>
          <p className="text-sm text-muted-foreground">
            Use os botoes acima para adicionar graficos, cards e tabelas
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {components.map((component, index) => {
            const typeInfo = getTypeInfo(component.type);
            const isExpanded = expandedId === component.id;
            const fields = getEntityFields(component.dataSource.entity);

            return (
              <div
                key={component.id}
                className={`border rounded-lg ${isExpanded ? 'ring-2 ring-primary' : ''}`}
              >
                {/* Header do componente */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedId(isExpanded ? null : component.id)}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />

                  <div className={`p-1.5 rounded ${typeInfo.bgColor}`}>
                    <typeInfo.icon className={`h-4 w-4 ${typeInfo.textColor}`} />
                  </div>

                  <div className="flex-1">
                    <span className="font-medium">{component.title}</span>
                    <span className="text-muted-foreground text-sm ml-2">({typeInfo.label})</span>
                  </div>

                  <Badge variant="outline">{component.width}</Badge>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); moveComponent(index, 'up'); }}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); moveComponent(index, 'down'); }}
                      disabled={index === components.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); removeComponent(component.id); }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Conteudo expandido */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t space-y-4">
                    {/* Config basica */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Titulo</Label>
                        <Input
                          value={component.title}
                          onChange={(e) => updateComponent(component.id, { title: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Largura</Label>
                        <Select
                          value={component.width}
                          onValueChange={(v) => updateComponent(component.id, { width: v as ComponentWidth })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="third">1/3 da tela</SelectItem>
                            <SelectItem value="half">1/2 da tela</SelectItem>
                            <SelectItem value="full">Tela inteira</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Fonte de dados */}
                    <div className={`p-4 rounded-lg ${typeInfo.bgColor} border`}>
                      <Label className="flex items-center gap-2 mb-3">
                        <Database className="h-4 w-4" />
                        Fonte de Dados
                      </Label>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Entidade</Label>
                          <Select
                            value={component.dataSource.entity}
                            onValueChange={(v) =>
                              updateComponent(component.id, {
                                dataSource: { ...component.dataSource, entity: v },
                              })
                            }
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {entities.map((e) => (
                                <SelectItem key={e.id} value={e.slug}>
                                  {e.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Periodo</Label>
                          <Select
                            value={component.dataSource.dateRange?.preset || 'month'}
                            onValueChange={(v) =>
                              updateComponent(component.id, {
                                dataSource: {
                                  ...component.dataSource,
                                  dateRange: { preset: v as 'today' | 'week' | 'month' | 'quarter' | 'year' },
                                },
                              })
                            }
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DATE_PRESETS.map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Config especifica por tipo */}
                    {['bar-chart', 'line-chart', 'area-chart', 'pie-chart'].includes(component.type) && (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Medida (Eixo Y)</Label>
                          <Select
                            value={component.config.measure || '_count'}
                            onValueChange={(v) =>
                              updateComponent(component.id, {
                                config: { ...component.config, measure: v },
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_count">Contagem de registros</SelectItem>
                              {fields
                                .filter((f) => ['number', 'currency', 'percentage'].includes(f.type))
                                .map((f) => (
                                  <SelectItem key={f.slug} value={f.slug}>
                                    {f.label || f.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Agregacao</Label>
                          <Select
                            value={component.config.aggregation || 'count'}
                            onValueChange={(v) =>
                              updateComponent(component.id, {
                                config: { ...component.config, aggregation: v as Aggregation },
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {AGGREGATIONS.map((a) => (
                                <SelectItem key={a.value} value={a.value}>
                                  {a.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Dimensao (Eixo X)</Label>
                          <Select
                            value={component.config.dimension || ''}
                            onValueChange={(v) =>
                              updateComponent(component.id, {
                                config: { ...component.config, dimension: v },
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {fields.map((f) => (
                                <SelectItem key={f.slug} value={f.slug}>
                                  {f.label || f.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {['stats-card', 'kpi'].includes(component.type) && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Medida</Label>
                          <Select
                            value={component.config.measure || '_count'}
                            onValueChange={(v) =>
                              updateComponent(component.id, {
                                config: { ...component.config, measure: v },
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_count">Contagem de registros</SelectItem>
                              {fields
                                .filter((f) => ['number', 'currency', 'percentage'].includes(f.type))
                                .map((f) => (
                                  <SelectItem key={f.slug} value={f.slug}>
                                    {f.label || f.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Agregacao</Label>
                          <Select
                            value={component.config.aggregation || 'count'}
                            onValueChange={(v) =>
                              updateComponent(component.id, {
                                config: { ...component.config, aggregation: v as Aggregation },
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {AGGREGATIONS.map((a) => (
                                <SelectItem key={a.value} value={a.value}>
                                  {a.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {component.type === 'table' && (
                      <div className="space-y-2">
                        <Label>Limite de registros</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={component.config.limit || 10}
                          onChange={(e) =>
                            updateComponent(component.id, {
                              config: { ...component.config, limit: parseInt(e.target.value) || 10 },
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
