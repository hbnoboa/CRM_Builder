'use client';

import { useEffect } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useSpeechInput, type SpeechError } from '@/hooks/use-speech-input';
import { cn } from '@/lib/utils';

const ERRORS: Record<SpeechError, string> = {
  denied: 'O microfone está bloqueado. Libere o microfone para este site nas permissões do navegador e toque de novo.',
  'no-speech': 'Não ouvi nada. Toque no microfone e fale de novo.',
  network: 'Sem internet para transcrever a fala. Tente de novo quando a conexão voltar.',
  failed: 'Não consegui usar o microfone. Tente de novo.',
};

function unsupportedMessage(): string {
  const firefox = typeof navigator !== 'undefined' && /firefox|fxios/i.test(navigator.userAgent);
  return firefox
    ? 'O Firefox não transforma fala em texto. Para falar em vez de digitar, abra o sistema no Chrome, no Edge ou no Safari.'
    : 'Este navegador não transforma fala em texto. Para falar em vez de digitar, use o Chrome, o Edge ou o Safari.';
}

/**
 * Microfone ao lado da caixa de texto: toca para falar, o texto vai aparecendo na
 * caixa e toca de novo para parar. A pessoa revisa e envia (nada vai sozinho).
 */
export function VoiceButton({ value, onChange, disabled, compact, className }: {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
  /** So o icone (caixas estreitas, como a do chat). */
  compact?: boolean;
  className?: string;
}) {
  const { supported, listening, start, stop } = useSpeechInput({
    value,
    onChange,
    onError: (e) => toast.error(ERRORS[e]),
  });

  // Enviou ou travou a caixa: para de ouvir
  useEffect(() => { if (disabled && listening) stop(); }, [disabled, listening, stop]);

  const click = () => {
    if (!supported) {
      toast.warning(unsupportedMessage(), { duration: 8000 });
      return;
    }
    if (listening) stop();
    else start();
  };

  const label = !supported ? 'Falar (não disponível neste navegador)' : listening ? 'Parar de ouvir' : 'Falar em vez de digitar';
  const Icon = !supported ? MicOff : listening ? Square : Mic;
  return (
    <Button
      type="button"
      variant={listening ? 'destructive' : 'outline'}
      size={compact ? 'icon' : 'sm'}
      className={cn(compact && 'h-9 w-9', 'shrink-0', listening && 'animate-pulse', !supported && 'opacity-60', className)}
      onClick={click}
      disabled={disabled && !listening}
      aria-pressed={listening}
      aria-label={label}
      title={label}
      data-testid="voice-button"
    >
      <Icon className={cn('h-4 w-4', !compact && 'mr-1.5', listening && 'fill-current')} />
      {!compact && (listening ? 'Parar' : 'Falar')}
    </Button>
  );
}
