import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import {
  ArrowRight, Bell, Camera, Check, CheckCircle2, Clock, FileText, LayoutDashboard, MessageSquare,
  Smartphone, Target, Users, X, type LucideIcon,
} from 'lucide-react';
import { SOLUTION_CATALOG } from '@crm-builder/shared';
import { locales } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { ContactFab } from '@/components/marketing/contact-fab';
import { SolutionIcon } from '@/components/marketing/solution-icon';
import { SOLUTION_PAGES, type StepIcon } from '@/components/marketing/content';

const STEP_ICONS: Record<StepIcon, LucideIcon> = {
  smartphone: Smartphone, camera: Camera, layout: LayoutDashboard, file: FileText, message: MessageSquare,
  bell: Bell, users: Users, target: Target, clock: Clock, check: CheckCircle2,
};

export function generateStaticParams() {
  return locales.flatMap((locale) => SOLUTION_CATALOG.map((s) => ({ locale, slug: s.slug })));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const solution = SOLUTION_CATALOG.find((s) => s.slug === params.slug);
  if (!solution) return {};
  return {
    title: `${solution.name} — CRM Builder`,
    description: SOLUTION_PAGES[solution.slug]?.intro ?? solution.tagline,
  };
}

export default function SolutionPage({ params }: { params: { slug: string } }) {
  const solution = SOLUTION_CATALOG.find((s) => s.slug === params.slug);
  const page = solution ? SOLUTION_PAGES[solution.slug] : undefined;
  if (!solution || !page) notFound();
  const others = SOLUTION_CATALOG.filter((s) => s.slug !== solution.slug);

  const includes = [
    { label: 'Tabelas', items: solution.includes.tables },
    { label: 'Cargos', items: solution.includes.roles },
    { label: 'Painéis', items: solution.includes.dashboards },
    { label: 'Documentos', items: solution.includes.documents },
    { label: 'Comandos no chat', items: solution.includes.commands },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />

      {/* Sub-navegacao da solucao (como na pagina de produto) */}
      <nav className="sticky z-30 border-b border-slate-200 bg-white/90 backdrop-blur" style={{ top: 'calc(4rem + env(safe-area-inset-top, 0px))' }} aria-label="Nesta página">
        <div className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto px-4 text-sm text-slate-600 sm:px-6">
          <span className="flex shrink-0 items-center gap-2 py-3 font-semibold text-slate-900">
            <SolutionIcon name={solution.icon} className="h-4 w-4" style={{ color: solution.color }} /> {solution.name}
          </span>
          {[['#visao-geral', 'Visão geral'], ['#como-funciona', 'Como funciona'], ['#o-que-vem', 'O que vem pronto'], ['#quem-usa', 'Quem usa'], ['#duvidas', 'Dúvidas']].map(([href, label]) => (
            <a key={href} href={href} className="shrink-0 py-3 hover:text-slate-900">{label}</a>
          ))}
        </div>
      </nav>

      <main>
        <section id="visao-geral" className="scroll-mt-32">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-20">
            <div>
              <p className="text-sm font-semibold" style={{ color: solution.color }}>Modelo pronto · {solution.audience}</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{page.headline}</h1>
              <p className="mt-5 text-lg text-slate-600">{page.intro}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="bg-orange-600 text-white hover:bg-orange-700">
                  <Link href={`/register?modelo=${solution.slug}`}>Usar este modelo grátis <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-900">
                  <Link href={`/contato?modelo=${solution.slug}`}>Falar com especialista</Link>
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
              <Image src={solution.image} alt={`Painel do modelo ${solution.name} com dados de exemplo`} width={1400} height={946} priority className="h-auto w-full" sizes="(min-width: 1024px) 560px, 100vw" />
            </div>
          </div>
        </section>

        <section className="border-y border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-xl font-semibold">O que esse modelo resolve</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {page.pains.map((p) => (
                <li key={p} className="flex items-start gap-3 rounded-xl bg-white p-4 text-sm text-slate-700 ring-1 ring-slate-200">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-32">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <p className="text-sm font-semibold text-orange-600">Como funciona</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Do campo ao relatório, no mesmo sistema</h2>
            <ol className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {page.steps.map((step, i) => {
                const Icon = STEP_ICONS[step.icon];
                return (
                  <li key={step.title} className="relative">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ backgroundColor: solution.color }}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Etapa {i + 1}</p>
                    <h3 className="mt-1 font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{step.text}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section id="o-que-vem" className="scroll-mt-32 bg-slate-950 text-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">O que vem pronto</h2>
            <p className="mt-3 max-w-2xl text-white/70">Tudo já configurado e editável. Você escolhe no cadastro se quer dados de exemplo para testar.</p>
            <dl className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {includes.map(({ label, items }) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-orange-400">{label}</dt>
                  <dd className="mt-3 space-y-1.5 text-sm text-white/85">
                    {items.map((item) => <span key={item} className="block">{item}</span>)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="quem-usa" className="scroll-mt-32">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">Cada pessoa vê o que precisa</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {page.personas.map((p) => (
                <div key={p.role} className="rounded-xl border border-slate-200 p-6">
                  <Users className="h-5 w-5" style={{ color: solution.color }} />
                  <h3 className="mt-3 font-semibold">{p.role}</h3>
                  <p className="mt-1 text-sm text-slate-600">{p.text}</p>
                </div>
              ))}
            </div>
            <ul className="mt-10 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
              {['App no celular que funciona sem internet', 'Exporta e importa Excel', 'Tudo ajustável sem programar'].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-orange-600" /> {t}</li>
              ))}
            </ul>
          </div>
        </section>

        <section id="duvidas" className="scroll-mt-32 border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight">Dúvidas sobre {solution.name}</h2>
            <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
              {page.faq.map((item) => (
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

        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl rounded-3xl bg-orange-600 px-6 py-14 text-center text-white sm:px-12">
            <h2 className="text-3xl font-bold tracking-tight">Comece com o modelo {solution.name}</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/85">Teste grátis, sem cartão. Ajuste o que quiser depois.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-white text-orange-700 hover:bg-orange-50">
                <Link href={`/register?modelo=${solution.slug}`}>Usar este modelo</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link href={`/contato?modelo=${solution.slug}`}>Falar com especialista</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <h2 className="text-lg font-semibold">Outros modelos</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {others.map((s) => (
              <Link key={s.slug} href={`/solucoes/${s.slug}`} className="flex gap-3 rounded-xl border border-slate-200 p-4 hover:shadow-md">
                <SolutionIcon name={s.icon} className="mt-0.5 h-5 w-5 shrink-0" style={{ color: s.color }} />
                <span>
                  <span className="block font-medium">{s.name}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{s.tagline}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
      <ContactFab />
    </div>
  );
}
