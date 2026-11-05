'use client';

import { MessageCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/** Botao flutuante "Falar com especialista" das paginas publicas. */
export function ContactFab() {
  return (
    <Link
      href="/contato"
      className="fixed right-4 z-30 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-slate-900/20 transition-transform hover:-translate-y-0.5 sm:right-6"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Falar com especialista</span>
      <span className="sm:hidden">Contato</span>
    </Link>
  );
}
