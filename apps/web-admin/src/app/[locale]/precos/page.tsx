import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { ContactFab } from '@/components/marketing/contact-fab';
import { Pricing } from '@/components/marketing/pricing';
import { PlanComparison } from '@/components/marketing/plan-comparison';
import { BILLING_FAQ } from '@/components/marketing/plans';

export const metadata: Metadata = {
  title: 'Preços e planos — CRM Builder',
  description: 'Planos Essencial, Profissional e Empresarial: preço por usuário e tudo o que vem em cada um.',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <main>
        <section className="bg-slate-50/60">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold text-orange-600">Preços</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Um plano para cada tamanho de operação</h1>
              <p className="mt-4 text-slate-600">Preço por usuário. Comece grátis e troque de plano quando precisar.</p>
            </div>
            <div className="mt-12">
              <Pricing />
            </div>
          </div>
        </section>

        <section id="comparar" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">O que vem em cada plano</h2>
            <p className="mt-3 text-slate-600">Todos os planos incluem os modelos prontos, o app offline e os documentos em PDF.</p>
            <div className="mt-10">
              <PlanComparison />
            </div>
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Dúvidas sobre cobrança</h2>
              <p className="mt-3 text-slate-600">Operação grande ou necessidade específica? Montamos uma proposta.</p>
              <Button asChild className="mt-6 bg-orange-600 text-white hover:bg-orange-700">
                <Link href="/contato">Falar com especialista <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {BILLING_FAQ.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {item.q}
                    <span className="text-xl leading-none text-slate-400 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <ContactFab />
    </div>
  );
}
