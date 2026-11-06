'use client';

import { useState } from 'react';
import { CircleHelp, PlayCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { HELP } from '@/lib/help-content';

/**
 * Botao "?" ao lado de um titulo ou campo: abre explicacao escrita, passo a passo
 * e, quando existe, um mini video das telas (public/help/<video>.webm).
 */
export function HelpButton({ topic, className, label }: { topic: string; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const help = HELP[topic];
  if (!help) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          label ? 'border px-2 py-0.5 text-xs' : 'h-5 w-5 justify-center',
          className,
        )}
        aria-label={`O que é: ${help.title}`}
        title={`O que é: ${help.title}`}
        data-testid={`help-${topic}`}
      >
        <CircleHelp className="h-4 w-4" />
        {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="help-dialog">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CircleHelp className="h-5 w-5 text-primary" /> {help.title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-foreground/80">{help.intro}</DialogDescription>
          {help.video && (
            <figure className="overflow-hidden rounded-lg border bg-muted">
              <video
                src={`/help/${help.video}.webm`}
                className="aspect-[16/10] w-full"
                autoPlay
                loop
                muted
                playsInline
                controls
                data-testid="help-video"
              />
              <figcaption className="flex items-center gap-1.5 border-t bg-card px-3 py-1.5 text-xs text-muted-foreground">
                <PlayCircle className="h-3.5 w-3.5" /> Veja como funciona
              </figcaption>
            </figure>
          )}
          {help.steps && help.steps.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-semibold">Como usar</p>
              <ol className="space-y-1.5">
                {help.steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nav-active text-[11px] font-semibold text-nav-active-foreground">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {help.example && (
            <p className="rounded-lg bg-muted/60 p-3 text-sm"><span className="font-medium">Exemplo: </span>{help.example}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
