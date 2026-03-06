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

import type { EntityField } from '@/types';

interface AutomationTabProps {
  entityId: string;
  fields: EntityField[];
}

export function AutomationTab({ entityId, fields }: AutomationTabProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    eventAutomations: true,
    scheduledAutomations: true,
  });

  const { data: automations } = useEntityAutomations(entityId);

  const eventAutomationsCount = (automations || []).filter(
    a => a.trigger !== 'SCHEDULE'
  ).length;
  const scheduledCount = (automations || []).filter(
    a => a.trigger === 'SCHEDULE'
  ).length;

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Regras de campo (obrigatoriedade, visibilidade, etc.) agora estao nas propriedades de cada campo, na secao &quot;Avancado&quot;.
      </p>

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
                  <h3 className="text-sm font-semibold">Automacoes de Evento</h3>
                  <p className="text-xs text-muted-foreground font-normal">
                    Executa acoes quando registros sao criados, atualizados, excluidos ou quando campos mudam
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
              <EventAutomationsSection entityId={entityId} fields={fields} />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* ── Section 2: Scheduled Automations ───────────────────────── */}
      <Collapsible
        open={openSections.scheduledAutomations}
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
                  <h3 className="text-sm font-semibold">Automacoes Agendadas</h3>
                  <p className="text-xs text-muted-foreground font-normal">
                    Automacoes executadas em horarios programados usando expressoes cron
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {scheduledCount}
                </Badge>
                {openSections.scheduledAutomations ? (
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
