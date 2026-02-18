'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { Report, ReportExecuteResult, ComponentType } from '@/services/reports.service';

interface ReportPreviewProps {
  report: Report;
  executionData?: ReportExecuteResult;
  isLoading?: boolean;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#22c55e', '#14b8a6', '#3b82f6'];

export function ReportPreview({ report, executionData, isLoading }: ReportPreviewProps) {
  const layoutConfig = report.layoutConfig || { columns: 2, gaps: 4 };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando dados...</span>
      </div>
    );
  }

  if (!executionData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum dado disponivel
      </div>
    );
  }

  const getColSpan = (width: string) => {
    switch (width) {
      case 'full':
        return layoutConfig.columns;
      case 'half':
        return Math.ceil(layoutConfig.columns / 2);
      default:
        return 1;
    }
  };

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${layoutConfig.columns}, minmax(0, 1fr))`,
        gap: `${(layoutConfig.gaps || 4) * 4}px`,
      }}
    >
      {executionData.components.map((componentData) => {
        const component = report.components.find((c) => c.id === componentData.id);
        if (!component) return null;

        const colSpan = getColSpan(component.width);

        return (
          <Card key={componentData.id} style={{ gridColumn: `span ${colSpan}` }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{componentData.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {componentData.error ? (
                <div className="flex items-center gap-2 text-destructive py-4">
                  <AlertCircle className="h-5 w-5" />
                  <span>{componentData.error}</span>
                </div>
              ) : (
                <ComponentRenderer
                  type={componentData.type as ComponentType}
                  data={componentData.data}
                  config={component.config}
                />
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Timestamp */}
      <div className="col-span-full text-right text-xs text-muted-foreground pt-4">
        Gerado em: {new Date(executionData.generatedAt).toLocaleString('pt-BR')}
      </div>
    </div>
  );
}

interface ComponentRendererProps {
  type: ComponentType;
  data: unknown;
  config: Record<string, unknown>;
}

function ComponentRenderer({ type, data, config }: ComponentRendererProps) {
  if (!data) {
    return <div className="text-muted-foreground text-center py-8">Sem dados</div>;
  }

  switch (type) {
    case 'stats-card':
    case 'kpi':
      return <StatsCardRenderer data={data} config={config} />;

    case 'bar-chart':
      return <BarChartRenderer data={data as Array<{ name: string; value: number }>} />;

    case 'line-chart':
    case 'area-chart':
      return <LineChartRenderer data={data as Array<{ name: string; value: number }>} />;

    case 'pie-chart':
      return <PieChartRenderer data={data as Array<{ name: string; value: number }>} />;

    case 'table':
      return <TableRenderer data={data as Array<Record<string, unknown>>} />;

    case 'trend':
      return <TrendRenderer data={data} />;

    default:
      return (
        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
  }
}

function StatsCardRenderer({ data, config }: { data: unknown; config: Record<string, unknown> }) {
  const value = typeof data === 'object' && data !== null && 'value' in data
    ? (data as { value: number }).value
    : 0;

  return (
    <div className="text-center py-4">
      <div className="text-4xl font-bold">{value.toLocaleString('pt-BR')}</div>
      {config.compareWithPrevious && (
        <div className="flex items-center justify-center gap-1 mt-2 text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm">+12% vs periodo anterior</span>
        </div>
      )}
    </div>
  );
}

function BarChartRenderer({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-muted-foreground text-center py-8">Sem dados</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="value" fill="#6366f1" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartRenderer({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-muted-foreground text-center py-8">Sem dados</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PieChartRenderer({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-muted-foreground text-center py-8">Sem dados</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function TableRenderer({ data }: { data: Array<Record<string, unknown>> }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-muted-foreground text-center py-8">Sem dados</div>;
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {columns.map((col) => (
              <th key={col} className="text-left py-2 px-2 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {columns.map((col) => (
                <td key={col} className="py-2 px-2">
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendRenderer({ data }: { data: unknown }) {
  const trendData = data as { current: number; previous: number; change: number; changePercent: number } | null;

  if (!trendData) {
    return <div className="text-muted-foreground text-center py-8">Sem dados</div>;
  }

  const isPositive = trendData.change >= 0;

  return (
    <div className="text-center py-4">
      <div className="text-3xl font-bold">{trendData.current.toLocaleString('pt-BR')}</div>
      <div className={`flex items-center justify-center gap-1 mt-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        <span className="text-sm">
          {isPositive ? '+' : ''}{trendData.changePercent.toFixed(1)}% vs anterior
        </span>
      </div>
    </div>
  );
}
