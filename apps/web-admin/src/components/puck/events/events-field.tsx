'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Zap } from 'lucide-react';
import { EventsPanel } from './events-panel';
import { ComponentEvent } from '@/lib/page-events';

interface EventsFieldProps {
  value: ComponentEvent[];
  onChange: (value: ComponentEvent[]) => void;
  componentType: string;
  componentId: string;
  availableApis?: { id: string; name: string; path: string; method: string }[];
  availableComponents?: { id: string; label: string; type: string }[];
}

export function EventsField({
  value = [],
  onChange,
  componentType,
  componentId,
  availableApis = [],
  availableComponents = [],
}: EventsFieldProps) {
  const [open, setOpen] = useState(false);
  const eventCount = value?.length || 0;
  const actionCount = value?.reduce((acc, e) => acc + (e.actions?.length || 0), 0) || 0;

  return (
    <div className="space-y-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            <Zap className="h-4 w-4 mr-2 text-yellow-500" />
            <span className="flex-1 text-left">
              {eventCount === 0
                ? 'Configurar Eventos'
                : `${eventCount} evento(s), ${actionCount} acao(oes)`}
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Eventos e Acoes
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <EventsPanel
              componentType={componentType}
              componentId={componentId}
              events={value || []}
              onChange={onChange}
              availableApis={availableApis}
              availableComponents={availableComponents}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dos eventos configurados */}
      {eventCount > 0 && (
        <div className="text-xs text-muted-foreground space-y-1">
          {value.map((event) => (
            <div key={event.id} className="flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${event.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
              />
              <span>
                {event.type}: {event.actions.length} acao(oes)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Wrapper para usar como custom field no Puck
export function createEventsFieldConfig(
  componentType: string,
  availableApis: { id: string; name: string; path: string; method: string }[] = [],
  availableComponents: { id: string; label: string; type: string }[] = []
) {
  return {
    type: 'custom',
    label: 'Eventos',
    render: ({ value, onChange, id }: { value: ComponentEvent[]; onChange: (v: ComponentEvent[]) => void; id: string }) => (
      <EventsField
        value={value}
        onChange={onChange}
        componentType={componentType}
        componentId={id}
        availableApis={availableApis}
        availableComponents={availableComponents}
      />
    ),
  };
}
