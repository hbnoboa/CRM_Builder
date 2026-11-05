'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { SOLUTION_CATALOG, SOLUTION_SLUGS } from '@crm-builder/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/api';

const TEAM_SIZES = ['1 a 5', '6 a 20', '21 a 50', '51 a 200', 'Mais de 200'];
const SEGMENTS = ['Transporte e logística', 'Assistência técnica', 'Indústria', 'Comércio e distribuição', 'Serviços', 'Saúde', 'Facilities e condomínios', 'Educação', 'Outro'];

const schema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome'),
  email: z.string().trim().email('E-mail inválido'),
  phone: z.string().trim().max(30).optional(),
  company: z.string().trim().min(2, 'Informe a empresa'),
  teamSize: z.string().optional(),
  segment: z.string().optional(),
  interest: z.string().optional(),
  message: z.string().max(3000).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'É preciso autorizar o contato' }) }),
  website: z.string().optional(),
});
type ContactForm = z.infer<typeof schema>;

const selectClass = 'flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600/40';
const fieldClass = 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400';

/** Formulario "Falar com especialista" (vai para o console da plataforma). */
export function ContactForm({ source }: { source: string }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<ContactForm>({
    resolver: zodResolver(schema),
    defaultValues: { interest: '' },
  });
  // Veio de uma pagina de modelo (?modelo=): ja marca o interesse
  const modelo = searchParams.get('modelo');
  useEffect(() => {
    if (modelo && SOLUTION_SLUGS.includes(modelo)) setValue('interest', modelo);
  }, [modelo, setValue]);

  const onSubmit = async (data: ContactForm) => {
    setError(null);
    try {
      const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== '' && v !== undefined));
      await api.post('/public/contact', { ...clean, source });
      setSent(true);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setError(status === 429 ? 'Muitas tentativas. Tente de novo em um minuto.' : 'Não foi possível enviar agora. Tente de novo em instantes.');
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center" data-testid="contact-sent">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h3 className="mt-4 text-lg font-semibold text-slate-900">Recebemos seu contato</h3>
        <p className="mt-2 text-sm text-slate-600">Um especialista vai falar com você em breve pelo e-mail ou telefone informado.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {/* Armadilha para robos: escondido de pessoas e de leitores de tela */}
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" {...register('website')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="c-name" className="text-slate-800">Nome</Label>
          <Input id="c-name" className={fieldClass} autoComplete="name" {...register('name')} />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <Label htmlFor="c-company" className="text-slate-800">Empresa</Label>
          <Input id="c-company" className={fieldClass} autoComplete="organization" {...register('company')} />
          {errors.company && <p className="mt-1 text-xs text-red-600">{errors.company.message}</p>}
        </div>
        <div>
          <Label htmlFor="c-email" className="text-slate-800">E-mail</Label>
          <Input id="c-email" type="email" className={fieldClass} autoComplete="email" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <Label htmlFor="c-phone" className="text-slate-800">Telefone / WhatsApp</Label>
          <Input id="c-phone" type="tel" className={fieldClass} autoComplete="tel" placeholder="(00) 00000-0000" {...register('phone')} />
        </div>
        <div>
          <Label htmlFor="c-team" className="text-slate-800">Tamanho da equipe</Label>
          <select id="c-team" className={selectClass} {...register('teamSize')}>
            <option value="">Selecione</option>
            {TEAM_SIZES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="c-segment" className="text-slate-800">Segmento</Label>
          <select id="c-segment" className={selectClass} {...register('segment')}>
            <option value="">Selecione</option>
            {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <Label htmlFor="c-interest" className="text-slate-800">Interesse</Label>
        <select id="c-interest" className={selectClass} {...register('interest')}>
          <option value="">Ainda não sei / outro processo</option>
          {SOLUTION_CATALOG.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor="c-message" className="text-slate-800">Conte um pouco do seu processo</Label>
        <Textarea id="c-message" rows={4} className={fieldClass} placeholder="O que vocês controlam hoje, em planilha, papel ou outro sistema?" {...register('message')} />
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" className="mt-0.5 rounded border-slate-300" {...register('consent')} />
        <span>Autorizo a IOS System a entrar em contato sobre o CRM Builder. Meus dados não serão usados para outra finalidade.</span>
      </label>
      {errors.consent && <p className="text-xs text-red-600">{errors.consent.message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 text-white hover:bg-orange-700 sm:w-auto">
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Falar com especialista
      </Button>
    </form>
  );
}
