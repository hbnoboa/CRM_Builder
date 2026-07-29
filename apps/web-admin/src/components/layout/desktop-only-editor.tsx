'use client';

/**
 * Bloqueio suave para editores WYSIWYG (builder de entidade, editor de PDF,
 * editor de dashboard). Essas ferramentas sao feitas para telas grandes; em
 * celular o layout de 2 colunas fica inutilizavel. Em vez de mostrar a tela
 * quebrada, mostramos um aviso (< md) com opcao "Continuar mesmo assim".
 *
 * Usa display:contents no wrapper no desktop para NAO interferir no layout do
 * editor (o wrapper some da arvore de layout).
 */

import { useState } from 'react';
import { Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/tenant-navigation';

export function DesktopOnlyEditor({
  children,
  action = 'editar',
}: {
  children: React.ReactNode;
  /** Complemento da frase: "Abra em um computador para {action}." */
  action?: string;
}) {
  const [forced, setForced] = useState(false);
  const router = useRouter();

  return (
    <>
      {!forced && (
        <div className="md:hidden flex flex-col items-center justify-center text-center gap-5 px-6 min-h-[65vh]">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <Monitor className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold">Edite no computador</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Este editor foi feito para telas maiores. Abra em um computador para {action} com conforto.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Button variant="default" onClick={() => router.back()}>Voltar</Button>
            <Button variant="ghost" size="sm" onClick={() => setForced(true)}>
              Continuar mesmo assim
            </Button>
          </div>
        </div>
      )}
      <div className={forced ? 'contents' : 'hidden md:contents'}>{children}</div>
    </>
  );
}
