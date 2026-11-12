'use client';

import { useState } from 'react';
import {
  ChevronDown, ChevronRight, Zap, Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useEntityAutomations } from '@/hooks/use-entity-automations';
import { EventAutomationsSection } from './event-automations-section';
import { ScheduledSection } from './scheduled-section';
import { HelpButton } from '@/components/help/help-button';

import type { EntityField } from '@/types';

interface AutomationTabProps {
  entityId: string;
  fields: EntityField[];
  entityName?: string;
  /** Ajustes da tabela: situacao e campo-titulo ajudam a montar as receitas. */
  statusField?: string;
  titleField?: string;
}

export function AutomationTab({ entityId, fields, entityName, statusField, titleField }: AutomationTabProps) {
  const { data: automations } = useEntityAutomations(entityId);
  const [openSections, setOpenSections] = useState<Record<string, boolean | undefined>>({
    eventAutomations: true,
    scheduledAutomations: undefined,
  });
  // Agendadas so abrem sozinhas quando ja existe alguma (sao para quem ja conhece)
  const hasScheduled = (automations || []).some((a) => a.trigger === 'SCHEDULE');


  const eventAutomationsCount = (automations || []).filter(
    a => a.trigger !== 'SCHEDULE'
  ).length;
  const scheduledCount = (automations || []).filter(
    a => a.trigger === 'SCHEDULE'
  ).length;

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !(prev[key] ?? (key === 'scheduledAutomations' && hasScheduled)) }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <HelpButton topic="module.automations" label="Como funcionam as automações" />
      </div>
      {/* ── Section 1: Event Automations ───────────────────────────── */}
      <Collapsible
        open={openSections.eventAutomations}
        onOpenChange={() => toggleSection('eventAutomations')}
      >
        <div className="border rounded-lg">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center justify-between w-full p-4 h-auto hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-amber-500" />
                <div className="text-left">
                  <h3 className="text-sm font-semibold">Quando algo acontecer</h3>
                  <p className="text-xs text-muted-foreground font-normal">
                    Avisos, e-mails e preenchimentos automáticos quando um registro é criado ou muda
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {eventAutomationsCount}
                </Badge>
                {openSections.eventAutomations ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-0">
              <EventAutomationsSection entityId={entityId} fields={fields} entityName={entityName} statusField={statusField} titleField={titleField} />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* ── Section 2: Scheduled Automations ───────────────────────── */}
      <Collapsible
        open={openSections.scheduledAutomations ?? hasScheduled}
        onOpenChange={() => toggleSection('scheduledAutomations')}
      >
        <div className="border rounded-lg">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center justify-between w-full p-4 h-auto hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-blue-500" />
                <div className="text-left">
                  <h3 className="text-sm font-semibold">Em horários marcados</h3>
                  <p className="text-xs text-muted-foreground font-normal">
                    Rodam todo dia, toda semana ou no horário que você escolher (avançado)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {scheduledCount}
                </Badge>
                {(openSections.scheduledAutomations ?? hasScheduled) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-0">
              <ScheduledSection entityId={entityId} fields={fields} />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
