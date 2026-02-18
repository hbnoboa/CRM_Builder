'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building, LayoutDashboard } from 'lucide-react';
import type { Report, ReportVisibility, TenantScope } from '@/services/reports.service';

interface BasicInfoTabProps {
  report: Partial<Report>;
  onChange: (updates: Partial<Report>) => void;
  isPlatformAdmin?: boolean;
}

const COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
];

export function BasicInfoTab({ report, onChange, isPlatformAdmin }: BasicInfoTabProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Card Principal */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes do Relatorio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={report.name || ''}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Ex: Vendas Mensais"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descricao</Label>
            <Textarea
              id="description"
              value={report.description || ''}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Descreva o proposito deste relatorio..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    report.color === color ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => onChange({ color })}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card de Permissoes */}
      <Card>
        <CardHeader>
          <CardTitle>Permissoes e Exibicao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Visibilidade</Label>
            <Select
              value={report.visibility || 'PRIVATE'}
              onValueChange={(v) => onChange({ visibility: v as ReportVisibility })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRIVATE">Apenas eu</SelectItem>
                <SelectItem value="TEAM">Meu time</SelectItem>
                <SelectItem value="ORGANIZATION">Organizacao</SelectItem>
                <SelectItem value="PUBLIC">Todos no tenant</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define quem pode visualizar este relatorio
            </p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-50 border border-indigo-200">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-indigo-600" />
              <div>
                <Label className="text-sm font-medium">Mostrar no Dashboard</Label>
                <p className="text-xs text-muted-foreground">
                  Exibir este relatorio na pagina inicial
                </p>
              </div>
            </div>
            <Switch
              checked={report.showInDashboard || false}
              onCheckedChange={(checked) => onChange({ showInDashboard: checked })}
            />
          </div>

          {report.showInDashboard && (
            <div className="space-y-2">
              <Label>Ordem no Dashboard</Label>
              <Input
                type="number"
                min={0}
                value={report.dashboardOrder || 0}
                onChange={(e) => onChange({ dashboardOrder: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Menor numero = aparece primeiro
              </p>
            </div>
          )}

          {/* Multi-tenant (Platform Admin only) */}
          {isPlatformAdmin && (
            <div className="space-y-2 p-3 rounded-lg bg-violet-50 border border-violet-200">
              <Label className="flex items-center gap-2">
                <Building className="h-4 w-4 text-violet-600" />
                Escopo de Tenants
              </Label>
              <Select
                value={report.tenantScope || 'CURRENT'}
                onValueChange={(v) => onChange({ tenantScope: v as TenantScope })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CURRENT">Tenant atual</SelectItem>
                  <SelectItem value="ALL">Todos os tenants</SelectItem>
                  <SelectItem value="SELECTED">Selecionar tenants</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Define de quais tenants os dados serao agregados
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
