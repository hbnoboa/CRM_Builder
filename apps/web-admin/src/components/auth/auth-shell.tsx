import { Check } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';
import { BrandLogo, PoweredByIos } from '@/components/brand/brand';

const HIGHLIGHTS = [
  'Tabelas, formulários e painéis sem programar',
  'App no celular que funciona sem internet',
  'Laudos, OS e propostas em PDF com um clique',
  'Cada cargo vê só o que precisa',
];

/** Login/cadastro: marca a esquerda, formulario a direita (empilha no celular). */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-orange-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />
        <Link href="/" className="relative">
          <BrandLogo inverted />
        </Link>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl font-bold leading-tight">
            O sistema da sua operação, montado do seu jeito.
          </h2>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/85">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-600">
                  <Check className="h-3 w-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <PoweredByIos inverted className="relative mt-auto pt-10" />
      </aside>

      <main className="flex min-h-screen flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="lg:invisible">
            <BrandLogo />
          </Link>
          <LanguageSwitcher />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
        <PoweredByIos className="mx-auto lg:hidden" />
      </main>
    </div>
  );
}
