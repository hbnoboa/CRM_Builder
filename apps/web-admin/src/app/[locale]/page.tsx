import type { Metadata } from 'next';
import Image from 'next/image';
import {
  ArrowRight, Bell, Blocks, ClipboardCheck, FileText, KeyRound, LayoutDashboard, MessageSquare,
  Plug, ShieldCheck, Smartphone, Users, Workflow, WifiOff,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { ContactFab } from '@/components/marketing/contact-fab';
import { SolutionsShowcase } from '@/components/marketing/solutions-showcase';
import { Pricing } from '@/components/marketing/pricing';
import { UseCases } from '@/components/marketing/use-cases';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { INTEGRATIONS, SECURITY } from '@/components/marketing/content';

export const metadata: Metadata = {
  title: 'CRM Builder — o sistema da sua operação, sem programar',
  description:
    'Monte tabelas, formulários, painéis e documentos em PDF sem programar. Modelos prontos de vistoria, ordem de serviço, vendas e manutenção, com app que funciona offline.',
};

const STEPS = [
  { title: 'Escolha um modelo', text: 'Vistoria, ordem de serviço, vendas, chamados — ou comece em branco.' },
  { title: 'Ajuste ao seu jeito', text: 'Arraste campos, crie cargos, monte painéis e documentos sem escrever código.' },
  { title: 'Sua equipe já usa', text: 'No navegador e no app do celular, inclusive onde não tem sinal.' },
];

const FEATURES = [
  { icon: Blocks, title: 'Tabelas e formulários', text: 'Campos de texto, foto, assinatura, local, listas, sub-tabelas e regras por campo.' },
  { icon: LayoutDashboard, title: 'Painéis por cargo', text: 'Indicadores, gráficos, quadro kanban e tabelas — cada cargo abre no painel dele.' },
  { icon: FileText, title: 'Documentos em PDF', text: 'Laudos, OS e propostas com fotos, tabelas e assinatura, gerados a partir do registro.' },
  { icon: Users, title: 'Permissões de verdade', text: 'Quem vê o quê: por tabela, por campo, só os próprios registros ou os da equipe.' },
  { icon: MessageSquare, title: 'Chat com comandos', text: 'Abra uma OS ou consulte pendências digitando /os ou /pendencias na conversa.' },
  { icon: Workflow, title: 'Automações e integrações', text: 'Avisos, webhooks e API para conversar com o ERP e os outros sistemas.' },
];

const FAQ = [
  {
    q: 'Preciso saber programar?',
    a: 'Não. Tudo é montado em telas: tabelas, campos, painéis, documentos e permissões. Os modelos já vêm prontos para usar.',
  },
  {
    q: 'O app funciona mesmo sem internet?',
    a: 'Sim. A equipe de campo registra, tira fotos e coleta assinaturas sem sinal; tudo sincroniza sozinho quando a conexão volta.',
  },
  {
    q: 'Posso mudar o modelo depois?',
    a: 'Pode. O modelo é só o ponto de partida: você renomeia, adiciona ou remove campos, tabelas, cargos e painéis quando quiser.',
  },
  {
    q: 'Consigo trazer minhas planilhas?',
    a: 'Sim. As tabelas importam e exportam Excel, então dá para começar com os dados que você já tem.',
  },
  {
    q: 'E os dados de exemplo?',
    a: 'Ao escolher um modelo você decide se quer registros fictícios para testar. Eles podem ser apagados a qualquer momento.',
  },
  {
    q: 'Como ficam a segurança e a LGPD?',
    a: 'Cada empresa tem seus dados isolados, com permissões por campo, verificação em 2 etapas, registro de sessões, lixeira e exportação completa dos dados.',
  },
];

export default function LocaleHome() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-96 max-w-4xl rounded-full bg-orange-500/15 blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-800">
                <WifiOff className="h-3.5 w-3.5" /> Sem programação · App que funciona offline
              </p>
              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
                O sistema da sua operação, <span className="text-orange-600">montado do seu jeito</span>.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
                Tabelas, formulários, painéis e documentos em PDF sem escrever código. Comece com um modelo pronto e
                coloque a equipe para usar hoje — no navegador e no celular, até onde não pega sinal.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="bg-orange-600 text-white hover:bg-orange-700">
                  <Link href="/register">
                    Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="bg-white text-slate-900 border-slate-300 hover:bg-slate-50 hover:text-slate-900">
                  <Link href="/contato">Falar com especialista</Link>
                </Button>
              </div>
              <p className="mt-3 text-xs text-slate-500">Teste grátis, sem cartão de crédito.</p>
            </div>

            <div className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
              <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                <span className="ml-3 text-xs text-slate-400">Funil de vendas · dados de exemplo</span>
              </div>
              <Image
                src="/home/crm-vendas-b2b.webp"
                alt="Painel do CRM Builder com funil de vendas, valor em negociação e oportunidades por etapa"
                width={1400}
                height={946}
                priority
                className="h-auto w-full"
                sizes="(min-width: 1024px) 1024px, 100vw"
              />
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section className="border-y border-slate-100 bg-slate-50/60">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Modelos */}
        <section id="modelos" className="scroll-mt-20 bg-slate-50/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-orange-600">Modelos prontos</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Comece pelo que já funciona no seu ramo</h2>
              <p className="mt-4 text-slate-600">
                Cada modelo traz tabelas, cargos, painéis, documentos e comandos do chat já configurados.
                Você escolhe se quer dados de exemplo para testar.
              </p>
            </div>
            <div className="mt-12">
              <SolutionsShowcase />
            </div>
          </div>
        </section>

        {/* Casos de uso */}
        <section id="casos-de-uso" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-orange-600">Casos de uso</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Onde o CRM Builder entra na sua empresa</h2>
              <p className="mt-4 text-slate-600">Escolha pelo seu segmento ou pela área que precisa organizar primeiro.</p>
            </div>
            <div className="mt-10">
              <UseCases />
            </div>
          </div>
        </section>

        {/* Como funciona (abas com telas reais) */}
        <section id="como-funciona" className="scroll-mt-20 border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-orange-600">Como funciona</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Você monta. A equipe usa. Sem programação.</h2>
              <p className="mt-4 text-slate-600">Estas são telas reais do sistema, com dados de exemplo.</p>
            </div>
            <div className="mt-10">
              <HowItWorks />
            </div>
          </div>
        </section>

        {/* Recursos */}
        <section id="recursos" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-orange-600">Recursos</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Tudo o que a operação precisa, num lugar só</h2>
            </div>
            <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
                    <Icon className="h-5 w-5 text-orange-600" />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Campo / offline */}
        <section id="app" className="scroll-mt-20 bg-slate-950 text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-orange-400">Feito para quem trabalha na rua</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Sem sinal? O trabalho continua.</h2>
              <p className="mt-4 text-white/70">
                O app guarda tudo no celular: vistoria, OS, foto, assinatura e localização. Quando a conexão volta,
                sincroniza sozinho — e cada pessoa só recebe os registros que o cargo dela pode ver.
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Smartphone, title: 'Android e iOS', text: 'Mesmo sistema do navegador, no bolso da equipe.' },
                { icon: WifiOff, title: 'Offline de verdade', text: 'Cria, edita e consulta sem internet.' },
                { icon: ClipboardCheck, title: 'Fotos e assinatura', text: 'Evidência anexada no próprio registro.' },
                { icon: Bell, title: 'Avisos na hora', text: 'Notificação quando algo muda no que é seu.' },
              ].map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <Icon className="h-5 w-5 text-orange-400" />
                  <p className="mt-3 font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-white/65">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Integracoes */}
        <section id="integracoes" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
              <div>
                <p className="text-sm font-semibold text-orange-600">Integrações</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Conversa com o que você já usa</h2>
                <p className="mt-4 text-slate-600">
                  O CRM Builder não precisa substituir o ERP: ele cuida da operação e troca dados com os outros sistemas.
                </p>
              </div>
              <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                {INTEGRATIONS.map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <Plug className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
                    <span>
                      <span className="block font-semibold">{item.title}</span>
                      <span className="mt-0.5 block text-sm text-slate-600">{item.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Seguranca */}
        <section id="seguranca" className="scroll-mt-20 border-t border-slate-100">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-orange-600">Segurança e LGPD</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Seus dados protegidos de ponta a ponta</h2>
            </div>
            <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {SECURITY.map((item, i) => {
                const Icon = [ShieldCheck, Users, KeyRound, ClipboardCheck, FileText, ShieldCheck][i] ?? ShieldCheck;
                return (
                  <div key={item.title} className="flex gap-4">
                    <Icon className="mt-0.5 h-6 w-6 shrink-0 text-slate-900" />
                    <div>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{item.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Precos */}
        <section id="precos" className="scroll-mt-20 border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold text-orange-600">Preços</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Pague pelo que a equipe usa</h2>
              <p className="mt-4 text-slate-600">Preço por usuário. Troque de plano quando precisar.</p>
            </div>
            <div className="mt-10">
              <Pricing showCompareLink />
            </div>
          </div>
        </section>

        {/* Duvidas */}
        <section id="duvidas" className="scroll-mt-20">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight">Dúvidas frequentes</h2>
            <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
              {FAQ.map((item) => (
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

        {/* CTA final */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-orange-600 px-6 py-14 text-center text-white sm:px-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Monte o seu sistema hoje</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/85">
              Escolha um modelo, convide a equipe e veja tudo funcionando ainda hoje.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-white text-orange-700 hover:bg-orange-50">
                <Link href="/register">
                  Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link href="/contato">Falar com especialista</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <ContactFab />
    </div>
  );
}
