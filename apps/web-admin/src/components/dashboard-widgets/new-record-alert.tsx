'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

const MUTE_KEY = (slug: string) => `alerta-som:${slug}`;

/** Dois toques curtos (sem arquivo de audio): ouvido de longe numa loja. */
function chime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [0, 0.22, 0.6, 0.82].forEach((at, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = i % 2 === 0 ? 880 : 1175;
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(0.35, now + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + at);
    osc.stop(now + at + 0.22);
  });
}

/**
 * Aviso de registro novo no painel (ex.: pedido que chegou): toca um som, mostra o
 * registro e conta os novos ate a pessoa olhar. So avisa o que o cargo dela ve (o
 * registro e buscado com as permissoes dela). Ligado por painel em settings.newRecordAlert.
 */
export function NewRecordAlert({ entitySlug, titleField, label }: { entitySlug: string; titleField?: string; label?: string }) {
  const router = useRouter();
  const myId = useAuthStore((s) => s.user?.id);
  const [muted, setMuted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [fresh, setFresh] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  const baseTitle = useRef<string>('');

  useEffect(() => {
    try { setMuted(localStorage.getItem(MUTE_KEY(entitySlug)) === 'off'); } catch { /* sem armazenamento */ }
  }, [entitySlug]);

  // O navegador so libera som depois de um toque na pagina
  const unlock = useCallback(() => {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audio.current ??= new Ctor();
    if (audio.current.state === 'suspended') void audio.current.resume();
    setLocked(audio.current.state !== 'running');
  }, []);
  useEffect(() => {
    const first = () => unlock();
    window.addEventListener('pointerdown', first, { once: true });
    const timer = setTimeout(() => setLocked(!audio.current || audio.current.state !== 'running'), 1500);
    return () => { window.removeEventListener('pointerdown', first); clearTimeout(timer); };
  }, [unlock]);

  // Titulo da aba pisca o numero de novos (tablet da loja com a aba em segundo plano)
  useEffect(() => {
    if (!baseTitle.current) baseTitle.current = document.title.replace(/^\(\d+\) /, '');
    document.title = fresh > 0 ? `(${fresh}) ${baseTitle.current}` : baseTitle.current;
  }, [fresh]);
  useEffect(() => () => { if (baseTitle.current) document.title = baseTitle.current; }, []);

  useEffect(() => {
    const onChange = async (e: Event) => {
      const d = (e as CustomEvent<{ operation?: string; entitySlug?: string; recordId?: string; userId?: string }>).detail;
      if (!d || d.operation !== 'created' || d.entitySlug !== entitySlug || !d.recordId || (d.userId && d.userId === myId)) return;
      let record: { id: string; data?: Record<string, unknown> } | null = null;
      try {
        record = (await api.get(`/data/${entitySlug}/${d.recordId}`)).data;
      } catch {
        return; // o cargo desta pessoa nao ve este registro
      }
      setFresh((n) => n + 1);
      if (!muted && audio.current?.state === 'running') chime(audio.current);
      const title = titleField ? String(record?.data?.[titleField] ?? '') : '';
      toast.info(`${label ?? 'Registro'} novo${title ? `: ${title}` : ''}`, {
        duration: 15000,
        action: { label: 'Abrir', onClick: () => router.push(`/data/${entitySlug}/${d.recordId}`) },
      });
    };
    window.addEventListener('entity-data-changed', onChange);
    return () => window.removeEventListener('entity-data-changed', onChange);
  }, [entitySlug, titleField, label, muted, myId, router]);

  const toggle = () => {
    unlock();
    const next = !muted;
    setMuted(next);
    try { localStorage.setItem(MUTE_KEY(entitySlug), next ? 'off' : 'on'); } catch { /* sem armazenamento */ }
  };

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2" data-testid="new-record-alert">
      <Button
        type="button" size="sm" variant={muted ? 'outline' : 'secondary'} className="h-8"
        onClick={locked ? unlock : toggle}
        aria-pressed={!muted}
        data-testid="new-record-sound"
      >
        {muted ? <BellOff className="mr-1.5 h-4 w-4" /> : <Bell className="mr-1.5 h-4 w-4" />}
        {locked && !muted ? 'Toque para ligar o som' : muted ? 'Som desligado' : 'Som ligado'}
      </Button>
      {fresh > 0 && (
        <button
          type="button"
          onClick={() => setFresh(0)}
          className={cn('inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground', 'animate-pulse')}
          data-testid="new-record-count"
        >
          <BellRing className="h-3.5 w-3.5" /> {fresh} {fresh === 1 ? 'novo' : 'novos'} · visto
        </button>
      )}
    </div>
  );
}
