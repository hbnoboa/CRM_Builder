import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CalendarCheck, LayoutTemplate, MessagesSquare } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { ContactForm } from '@/components/marketing/contact-form';

export const metadata: Metadata = {
  title: 'Falar com especialista — CRM Builder',
  description: 'Conte como é o seu processo e um especialista mostra como montar no CRM Builder.',
};

const WHAT_HAPPENS = [
  { icon: MessagesSquare, title: 'Conversa rápida', text: 'Entendemos o que vocês controlam hoje e onde dói.' },
  { icon: LayoutTemplate, title: 'Demonstração no seu caso', text: 'Mostramos o modelo mais próximo, já ajustado ao seu processo.' },
  { icon: CalendarCheck, title: 'Plano de implantação', text: 'Campos, cargos, painéis, importação das planilhas e treinamento.' },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-24">
        <div>
          <p className="text-sm font-semibold text-orange-600">Falar com especialista</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">Vamos montar o sistema da sua operação</h1>
          <p className="mt-4 text-slate-600">
            Conte como é o seu processo. Um especialista mostra o CRM Builder com o seu caso e ajuda a colocar a equipe
            para usar.
          </p>
          <ul className="mt-10 space-y-6">
            {WHAT_HAPPENS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50">
                  <Icon className="h-5 w-5 text-orange-600" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="mt-0.5 block text-sm text-slate-600">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-sm text-slate-500">
            Prefere testar sozinho?{' '}
            <Link href="/register" className="font-medium text-orange-600 hover:underline">Comece grátis</Link>.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
          <Suspense>
            <ContactForm source="/contato" />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
