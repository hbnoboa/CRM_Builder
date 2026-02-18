'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart3, LineChart, PieChart, TrendingUp, Hash, Table, Gauge } from 'lucide-react';
import type { ReportComponent, ComponentType, ComponentWidth, LayoutConfig } from '@/services/reports.service';

interface LayoutTabProps {
  components: ReportComponent[];
  layoutConfig?: LayoutConfig;
  onChange: (components: ReportComponent[]) => void;
  onLayoutChange: (config: LayoutConfig) => void;
}

const COMPONENT_ICONS: Record<ComponentType, React.ElementType> = {
  'stats-card': Hash,
  'bar-chart': BarChart3,
  'line-chart': LineChart,
  'area-chart': LineChart,
  'pie-chart': PieChart,
  'table': Table,
  'kpi': TrendingUp,
  'trend': TrendingUp,
  'gauge': Gauge,
};

const WIDTH_CLASSES: Record<ComponentWidth, string> = {
  third: 'col-span-1',
  half: 'col-span-1 md:col-span-2',
  full: 'col-span-1 md:col-span-4',
};

export function LayoutTab({ components, layoutConfig, onChange, onLayoutChange }: LayoutTabProps) {
  const updateComponentWidth = (id: string, width: ComponentWidth) => {
    onChange(components.map((c) => (c.id === id ? { ...c, width } : c)));
  };

  return (
    <div className="space-y-6">
      {/* Configuracao do Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Configuracao do Layout</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="space-y-2">
              <Label>Colunas</Label>
              <Select
                value={String(layoutConfig?.columns || 2)}
                onValueChange={(v) => onLayoutChange({ ...layoutConfig, columns: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 coluna</SelectItem>
                  <SelectItem value="2">2 colunas</SelectItem>
                  <SelectItem value="3">3 colunas</SelectItem>
                  <SelectItem value="4">4 colunas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Espacamento</Label>
              <Select
                value={String(layoutConfig?.gaps || 4)}
                onValueChange={(v) => onLayoutChange({ ...layoutConfig, gaps: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Pequeno</SelectItem>
                  <SelectItem value="4">Medio</SelectItem>
                  <SelectItem value="6">Grande</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview do Layout */}
      <Card>
        <CardHeader>
          <CardTitle>Preview do Layout</CardTitle>
        </CardHeader>
        <CardContent>
          {components.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Adicione componentes na aba anterior para visualizar o layout
            </div>
          ) : (
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${layoutConfig?.columns || 2}, minmax(0, 1fr))`,
                gap: `${(layoutConfig?.gaps || 4) * 4}px`,
              }}
            >
              {components.map((component) => {
                const Icon = COMPONENT_ICONS[component.type];
                const colSpan = component.width === 'full' ? (layoutConfig?.columns || 2) : component.width === 'half' ? Math.ceil((layoutConfig?.columns || 2) / 2) : 1;

                return (
                  <div
                    key={component.id}
                    className="border rounded-lg p-4 bg-muted/30"
                    style={{ gridColumn: `span ${colSpan}` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{component.title}</span>
                      </div>
                      <Select
                        value={component.width}
                        onValueChange={(v) => updateComponentWidth(component.id, v as ComponentWidth)}
                      >
                        <SelectTrigger className="w-24 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="third">1/3</SelectItem>
                          <SelectItem value="half">1/2</SelectItem>
                          <SelectItem value="full">Full</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="h-24 bg-muted rounded flex items-center justify-center">
                      <Icon className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {component.dataSource.entity || 'Sem entidade'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {component.dataSource.dateRange?.preset || 'month'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
