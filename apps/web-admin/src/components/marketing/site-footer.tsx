import { SOLUTION_CATALOG } from '@crm-builder/shared';
import { Link } from '@/i18n/navigation';
import { BrandLogo, PoweredByIos } from '@/components/brand/brand';

const COLUMNS = [
  {
    title: 'Produto',
    links: [
      { href: '/#como-funciona', label: 'Como funciona' },
      { href: '/#recursos', label: 'Recursos' },
      { href: '/#app', label: 'App offline' },
      { href: '/#integracoes', label: 'Integrações' },
      { href: '/precos', label: 'Preços' },
    ],
  },
  {
    title: 'Soluções',
    links: [
      ...SOLUTION_CATALOG.map((s) => ({ href: `/solucoes/${s.slug}`, label: s.name })),
      { href: '/#casos-de-uso', label: 'Casos de uso' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { href: '/contato', label: 'Falar com especialista' },
      { href: '/#seguranca', label: 'Segurança e LGPD' },
      { href: '/#duvidas', label: 'Dúvidas frequentes' },
    ],
  },
  {
    title: 'Conta',
    links: [
      { href: '/register', label: 'Criar conta' },
      { href: '/login', label: 'Entrar' },
      { href: '/forgot-password', label: 'Esqueci a senha' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
        <div>
          <BrandLogo fixedDark />
          <p className="mt-3 max-w-xs text-sm text-slate-500">
            O sistema da sua operação, montado do seu jeito: tabelas, painéis, documentos e app offline.
          </p>
          <PoweredByIos className="mt-4" />
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-semibold text-slate-900">{col.title}</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-slate-900">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-400 sm:px-6">© {new Date().getFullYear()} IOS System. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
