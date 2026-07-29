'use client';

import { useEffect, useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface CommandLite {
  id: string;
  slug: string;
  description?: string | null;
  execMode?: string;
  isActive?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 'create' = escolher na criação do chat; 'manage' = editar comandos de um chat existente */
  mode: 'create' | 'manage';
  /** ids já selecionados (manage) — na criação, começa tudo marcado */
  initialSelected?: string[];
  confirmLabel: string;
  onConfirm: (commandIds: string[]) => Promise<void> | void;
}

export function CommandPickerDialog({
  open,
  onOpenChange,
  mode,
  initialSelected,
  confirmLabel,
  onConfirm,
}: Props) {
  const [commands, setCommands] = useState<CommandLite[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get('/chat/commands/manage')
      .then((r) => {
        const list = ((r.data || []) as CommandLite[]).filter((c) => c.isActive !== false);
        setCommands(list);
        // create: tudo marcado por padrão. manage: o que já estava anexado.
        setSelected(new Set(mode === 'manage' ? (initialSelected || []) : list.map((c) => c.id)));
      })
      .catch(() => setCommands([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOn = commands.length > 0 && commands.every((c) => selected.has(c.id));
  const toggleAll = () =>
    setSelected(allOn ? new Set() : new Set(commands.map((c) => c.id)));

  const confirm = async () => {
    setSaving(true);
    try {
      await onConfirm(Array.from(selected));
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Comandos deste chat' : 'Editar comandos do chat'}
          </DialogTitle>
          <DialogDescription>
            Escolha quais comandos ficam disponíveis neste chat. Você pode pegar alguns ou todos.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : commands.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum comando cadastrado ainda.
          </p>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            <label className="flex items-center gap-2 text-sm font-medium border-b pb-2 cursor-pointer">
              <Checkbox checked={allOn} onCheckedChange={toggleAll} />
              Selecionar todos ({selected.size}/{commands.length})
            </label>
            {commands.map((c) => (
              <label key={c.id} className="flex items-start gap-2 text-sm cursor-pointer py-1">
                <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} className="mt-0.5" />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono font-medium">/{c.slug}</span>
                    {c.execMode === 'as_bot' && <Badge variant="secondary" className="text-[10px]">bot</Badge>}
                  </span>
                  {c.description && <span className="block text-xs text-muted-foreground truncate">{c.description}</span>}
                </span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            <MessageSquare className="h-4 w-4 mr-1" />
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
