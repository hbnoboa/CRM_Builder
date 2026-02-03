'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartProps {
  title?: string;
  data: ChartDataPoint[];
  height?: number;
  showLegend?: boolean;
  showValues?: boolean;
}

// Color palette for charts
const CHART_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export function BarChart({ title, data, height = 200, showLegend = true, showValues = true }: ChartProps) {
  const safeData = Array.isArray(data) ? data : [];
  const maxValue = Math.max(...safeData.map(d => d.value || 0), 1);

  if (safeData.length === 0) {
    return (
      <div className="border rounded-lg p-8 bg-muted/50 text-center">
        <p className="text-muted-foreground">📊 Configure os dados do gráfico</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {title && (
        <h3 className="font-semibold mb-4">{title}</h3>
      )}
      <div className="flex items-end gap-2" style={{ height }}>
        {safeData.map((item, idx) => {
          const barHeight = (item.value / maxValue) * 100;
          const color = item.color || CHART_COLORS[idx % CHART_COLORS.length];
          
          return (
            <div key={idx} className="flex-1 flex flex-col items-center">
              <div className="w-full flex flex-col items-center justify-end" style={{ height: height - 30 }}>
                {showValues && (
                  <span className="text-xs font-medium mb-1">{item.value}</span>
                )}
                <div
                  className="w-full max-w-12 rounded-t transition-all duration-500"
                  style={{
                    height: `${barHeight}%`,
                    backgroundColor: color,
                    minHeight: 4,
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground mt-2 truncate max-w-full text-center">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
      {showLegend && safeData.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {safeData.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: item.color || CHART_COLORS[idx % CHART_COLORS.length] }}
              />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LineChart({ title, data, height = 200, showLegend = true, showValues = true }: ChartProps) {
  const safeData = Array.isArray(data) ? data : [];
  const maxValue = Math.max(...safeData.map(d => d.value || 0), 1);
  const minValue = Math.min(...safeData.map(d => d.value || 0), 0);
  const range = maxValue - minValue || 1;

  if (safeData.length === 0) {
    return (
      <div className="border rounded-lg p-8 bg-muted/50 text-center">
        <p className="text-muted-foreground">📈 Configure os dados do gráfico</p>
      </div>
    );
  }

  // Generate SVG path
  const chartHeight = height - 40;
  const chartWidth = 100; // percentage
  const points = safeData.map((item, idx) => {
    const x = (idx / (safeData.length - 1 || 1)) * chartWidth;
    const y = chartHeight - ((item.value - minValue) / range) * chartHeight;
    return { x, y, ...item };
  });

  const pathD = points.reduce((acc, point, idx) => {
    if (idx === 0) return `M ${point.x} ${point.y}`;
    return `${acc} L ${point.x} ${point.y}`;
  }, '');

  const areaD = `${pathD} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <div className="w-full">
      {title && (
        <h3 className="font-semibold mb-4">{title}</h3>
      )}
      <div className="relative" style={{ height }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(y => (
            <line
              key={y}
              x1="0"
              y1={y * chartHeight / 100}
              x2={chartWidth}
              y2={y * chartHeight / 100}
              className="stroke-muted"
              strokeWidth="0.5"
            />
          ))}
          
          {/* Area fill */}
          <path
            d={areaD}
            fill="url(#gradient)"
            opacity="0.2"
          />
          
          {/* Line */}
          <path
            d={pathD}
            fill="none"
            className="stroke-primary"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Points */}
          {points.map((point, idx) => (
            <circle
              key={idx}
              cx={point.x}
              cy={point.y}
              r="3"
              className="fill-primary"
            />
          ))}
          
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" className="stop-primary" stopOpacity="0.5" />
              <stop offset="100%" className="stop-primary" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between">
          {safeData.map((item, idx) => (
            <span key={idx} className="text-xs text-muted-foreground">
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PieChart({ title, data, height = 200, showLegend = true, showValues = true }: ChartProps) {
  const safeData = Array.isArray(data) ? data : [];
  const total = safeData.reduce((sum, item) => sum + (item.value || 0), 0) || 1;

  if (safeData.length === 0) {
    return (
      <div className="border rounded-lg p-8 bg-muted/50 text-center">
        <p className="text-muted-foreground">🥧 Configure os dados do gráfico</p>
      </div>
    );
  }

  const size = Math.min(height, 200);
  const center = size / 2;
  const radius = size / 2 - 10;

  // Calculate pie slices
  let currentAngle = -90; // Start from top
  const slices = safeData.map((item, idx) => {
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    const endAngle = currentAngle;
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    
    const largeArc = angle > 180 ? 1 : 0;
    
    const pathD = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    
    return {
      ...item,
      pathD,
      percentage: ((item.value / total) * 100).toFixed(1),
      color: item.color || CHART_COLORS[idx % CHART_COLORS.length],
    };
  });

  return (
    <div className="w-full flex flex-col items-center">
      {title && (
        <h3 className="font-semibold mb-4">{title}</h3>
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, idx) => (
          <path
            key={idx}
            d={slice.pathD}
            fill={slice.color}
            className="transition-all duration-300 hover:opacity-80"
            stroke="white"
            strokeWidth="2"
          />
        ))}
      </svg>
      {showLegend && (
        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {slices.map((slice, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-xs text-muted-foreground">
                {slice.label}
                {showValues && ` (${slice.percentage}%)`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChartPreview({ title, data, type }: ChartProps & { type?: 'bar' | 'line' | 'pie' }) {
  const chartIcons = {
    bar: '📊',
    line: '📈',
    pie: '🥧',
  };

  return (
    <div className="border rounded-lg p-4 bg-muted/50">
      <p className="text-center text-muted-foreground mb-2">
        {chartIcons[type || 'bar']} {title || `${(type || 'bar').charAt(0).toUpperCase() + (type || 'bar').slice(1)} Chart`}
      </p>
      <div className="flex justify-center items-end gap-1 h-16">
        {type === 'pie' ? (
          <div className="w-12 h-12 rounded-full border-4 border-primary" style={{
            background: 'conic-gradient(#3b82f6 0deg 120deg, #22c55e 120deg 200deg, #f59e0b 200deg 360deg)'
          }} />
        ) : type === 'line' ? (
          <svg viewBox="0 0 60 30" className="w-24 h-12">
            <polyline
              points="0,25 15,20 30,10 45,15 60,5"
              fill="none"
              className="stroke-primary"
              strokeWidth="2"
            />
          </svg>
        ) : (
          <>
            <div className="w-4 h-8 bg-blue-500 rounded-t" />
            <div className="w-4 h-12 bg-green-500 rounded-t" />
            <div className="w-4 h-6 bg-amber-500 rounded-t" />
            <div className="w-4 h-10 bg-red-500 rounded-t" />
          </>
        )}
      </div>
    </div>
  );
}

// Alias exports for individual chart previews
export const BarChartPreview = (props: ChartProps) => <ChartPreview {...props} type="bar" />;
export const LineChartPreview = (props: ChartProps) => <ChartPreview {...props} type="line" />;
export const PieChartPreview = (props: ChartProps) => <ChartPreview {...props} type="pie" />;
