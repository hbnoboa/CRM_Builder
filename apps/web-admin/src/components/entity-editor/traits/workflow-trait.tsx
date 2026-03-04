'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, ArrowRight } from 'lucide-react';

interface WorkflowStatus {
  value: string;
  label: string;
  color: string;
  isFinal?: boolean;
  isInitial?: boolean;
}

interface WorkflowTransition {
  from: string | string[];
  to: string;
  requiredFields?: string[];
  requiredPermission?: string;
}

interface WorkflowConfig {
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
}

const STATUS_COLORS = [
  '#6b7280', '#3b82f6', '#22c55e', '#eab308', '#f97316',
  '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#0f172a',
];

interface WorkflowTraitProps {
  value: string; // JSON string of WorkflowConfig
  onChange: (value: string) => void;
}

export function WorkflowTraitEditor({ value, onChange }: WorkflowTraitProps) {
  const [config, setConfig] = useState<WorkflowConfig>(() => {
    try {
      const parsed = JSON.parse(value || '{}');
      return {
        statuses: parsed.statuses || [],
        transitions: parsed.transitions || [],
      };
    } catch {
      return { statuses: [], transitions: [] };
    }
  });

  const [activeTab, setActiveTab] = useState<'statuses' | 'transitions'>('statuses');

  const sync = (updated: WorkflowConfig) => {
    setConfig(updated);
    onChange(JSON.stringify(updated));
  };

  // ─── Statuses ──────────────────────────────────────────────
  const addStatus = () => {
    const idx = config.statuses.length + 1;
    const isFirst = config.statuses.length === 0;
    sync({
      ...config,
      statuses: [
        ...config.statuses,
        {
          value: `status_${idx}`,
          label: `Status ${idx}`,
          color: STATUS_COLORS[(idx - 1) % STATUS_COLORS.length],
          isInitial: isFirst,
        },
      ],
    });
  };

  const updateStatus = (index: number, updates: Partial<WorkflowStatus>) => {
    const statuses = [...config.statuses];
    statuses[index] = { ...statuses[index], ...updates };

    // Auto-sync value from label
    if (updates.label !== undefined) {
      const oldValue = statuses[index].value;
      if (oldValue.startsWith('status_') || oldValue === '') {
        statuses[index].value = updates.label
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '');
      }
    }

    // Only one initial
    if (updates.isInitial) {
      statuses.forEach((s, i) => {
        if (i !== index) s.isInitial = false;
      });
    }

    sync({ ...config, statuses });
  };

  const removeStatus = (index: number) => {
    const removed = config.statuses[index];
    const statuses = config.statuses.filter((_, i) => i !== index);
    // Remove transitions referencing this status
    const transitions = config.transitions.filter(
      (t) => t.to !== removed.value &&
        (Array.isArray(t.from) ? !t.from.includes(removed.value) : t.from !== removed.value),
    );
    sync({ statuses, transitions });
  };

  const cycleColor = (index: number) => {
    const current = config.statuses[index].color;
    const currentIdx = STATUS_COLORS.indexOf(current);
    const next = STATUS_COLORS[(currentIdx + 1) % STATUS_COLORS.length];
    updateStatus(index, { color: next });
  };

  // ─── Transitions ──────────────────────────────────────────
  const addTransition = () => {
    if (config.statuses.length < 2) return;
    const from = config.statuses[0]?.value || '';
    const to = config.statuses[1]?.value || config.statuses[0]?.value || '';
    sync({
      ...config,
      transitions: [...config.transitions, { from, to }],
    });
  };

  const updateTransition = (index: number, updates: Partial<WorkflowTransition>) => {
    const transitions = [...config.transitions];
    transitions[index] = { ...transitions[index], ...updates };
    sync({ ...config, transitions });
  };

  const removeTransition = (index: number) => {
    sync({
      ...config,
      transitions: config.transitions.filter((_, i) => i !== index),
    });
  };

  const getStatusLabel = (value: string) => {
    return config.statuses.find((s) => s.value === value)?.label || value;
  };

  return (
    <div className="space-y-2">
      {/* Tabs */}
      <div className="flex border-b">
        <button
          className={`flex-1 text-xs py-1.5 border-b-2 transition-colors ${
            activeTab === 'statuses'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-muted-foreground'
          }`}
          onClick={() => setActiveTab('statuses')}
        >
          Status ({config.statuses.length})
        </button>
        <button
          className={`flex-1 text-xs py-1.5 border-b-2 transition-colors ${
            activeTab === 'transitions'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-muted-foreground'
          }`}
          onClick={() => setActiveTab('transitions')}
        >
          Transicoes ({config.transitions.length})
        </button>
      </div>

      {/* Statuses tab */}
      {activeTab === 'statuses' && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addStatus}>
              <Plus className="h-3 w-3 mr-1" /> Status
            </Button>
          </div>

          {config.statuses.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-2">Nenhum status. Adicione ao menos 2.</p>
          )}

          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {config.statuses.map((status, i) => (
              <div key={i} className="flex items-center gap-1 group">
                <button
                  className="w-4 h-4 rounded-full border flex-shrink-0"
                  style={{ backgroundColor: status.color }}
                  onClick={() => cycleColor(i)}
                  title="Mudar cor"
                />

                <Input
                  value={status.label}
                  onChange={(e) => updateStatus(i, { label: e.target.value })}
                  className="h-7 text-xs flex-1"
                  placeholder="Nome do status"
                />

                <button
                  className={`text-[9px] px-1 rounded border ${
                    status.isInitial
                      ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                      : 'text-muted-foreground border-transparent hover:border-border'
                  }`}
                  onClick={() => updateStatus(i, { isInitial: !status.isInitial })}
                  title="Status inicial"
                >
                  I
                </button>

                <button
                  className={`text-[9px] px-1 rounded border ${
                    status.isFinal
                      ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800'
                      : 'text-muted-foreground border-transparent hover:border-border'
                  }`}
                  onClick={() => updateStatus(i, { isFinal: !status.isFinal })}
                  title="Status final"
                >
                  F
                </button>

                <button
                  className="text-muted-foreground hover:text-destructive p-0.5 opacity-0 group-hover:opacity-100"
                  onClick={() => removeStatus(i)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transitions tab */}
      {activeTab === 'transitions' && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={addTransition}
              disabled={config.statuses.length < 2}
            >
              <Plus className="h-3 w-3 mr-1" /> Transicao
            </Button>
          </div>

          {config.statuses.length < 2 && (
            <p className="text-xs text-muted-foreground italic py-2">Adicione ao menos 2 status primeiro.</p>
          )}

          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {config.transitions.map((transition, i) => (
              <div key={i} className="flex items-center gap-1 group">
                <select
                  value={Array.isArray(transition.from) ? transition.from[0] : transition.from}
                  onChange={(e) => updateTransition(i, { from: e.target.value })}
                  className="h-7 text-xs border rounded px-1 bg-background flex-1"
                >
                  {config.statuses.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>

                <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />

                <select
                  value={transition.to}
                  onChange={(e) => updateTransition(i, { to: e.target.value })}
                  className="h-7 text-xs border rounded px-1 bg-background flex-1"
                >
                  {config.statuses.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>

                <button
                  className="text-muted-foreground hover:text-destructive p-0.5 opacity-0 group-hover:opacity-100"
                  onClick={() => removeTransition(i)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
