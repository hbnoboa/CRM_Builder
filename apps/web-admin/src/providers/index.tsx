'use client';

import { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { QueryProvider } from './query-provider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      {children}
      {/* pointer-events: o modal do Radix bloqueia cliques fora dele (body); sem isto o
          "Desfazer" de um toast aberto sobre um formulario nao era clicavel. */}
      <Toaster position="top-right" richColors closeButton style={{ pointerEvents: 'auto' }} />
    </QueryProvider>
  );
}
