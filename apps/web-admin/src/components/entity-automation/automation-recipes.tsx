'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Bell, CalendarCheck, Globe, Loader2, Mail, MessageSquareMore, Wrench, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BindingTextInput } from '@/components/pdf/binding-text-input';
import { useCreateAutomation } from '@/hooks/use-entity-automations';
import { api } from '@/lib/api';
import { withoutSystemFields } from '@/lib/system-fields';
import { cn } from '@/lib/utils';
import type { CreateAutomationData } from '@/services/entity-automation.service';
import type { EntityField } from '@/types';

type RecipeKey = 'notify-new' | 'notify-status' | 'email-status' | 'fill-date' | 'webhook';
type Option = { value: string; label: string };

const RECIPES: Array<{ key: RecipeKey; icon: LucideIcon; title: string; example: string }> = [
  { key: 'notify-new', icon: Bell, title: 'Avisar alguém quando chegar um registro novo', example: 'Ex.: o gerente recebe um aviso a cada nova OS.' },
  { key: 'notify-status', icon: MessageSquareMore, title: 'Avisar alguém quando a situação mudar', example: 'Ex.: avisar o técnico quando a OS for "Agendada".' },
  { key: 'email-status', icon: Mail, title: 'Mandar e-mail quando a situação mudar', example: 'Ex.: e-mail ao cliente quando a OS for "Concluída".' },
  { key: 'fill-date', icon: CalendarCheck, title: 'Preencher uma data sozinho', example: 'Ex.: "Concluída em" recebe a data de hoje ao concluir.' },
  { key: 'webhook', icon: Globe, title: 'Enviar os dados para outro sistema', example: 'Ex.: mandar cada cliente novo para o ERP ou para o Zapier.' },
];

const optionsOf = (f?: EntityField): Option[] =>
  f?.type === 'boolean'
    ? [{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }]
    : ((f?.options || []) as Array<string | Option>).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

function Select({ value, onChange, children, testId }: { value: string; onChange: (v: string) => void; children: React.ReactNode; testId?: string }) {
  return (
    <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
      {children}
    </select>
  );
}

/**
 * "O que você quer automatizar?": receitas prontas montadas com os campos da tabela,
 * preenchidas em 2-3 escolhas. "Montar do zero" abre o assistente completo.
 */
export function AutomationRecipes({
  open, onOpenChange, entityId, entityName, fields, statusField, titleField, onCustom,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityName: string;
  fields: EntityField[];
  statusField?: string;
  titleField?: string;
  onCustom: () => void;
}) {
  const [recipe, setRecipe] = useState<RecipeKey | null>(null);
  const create = useCreateAutomation(entityId, { success: 'Automação criada e ligada', error: 'Não foi possível criar a automação' });
  const { data: team } = useQuery({
    queryKey: ['team-directory'],
    queryFn: async () => (await api.get<Array<{ id: string; name: string }>>('/team-directory')).data,
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const own = useMemo(() => withoutSystemFields(fields), [fields]);
  const statusFields = own.filter((f) => ['select', 'radio-group', 'boolean'].includes(f.type));
  const dateFields = own.filter((f) => ['date', 'datetime'].includes(f.type));
  const emailFields = own.filter((f) => f.type === 'email');
  const titleSlug = titleField ?? own.find((f) => f.type === 'text')?.slug;
  const recordName = titleSlug ? `{{record.${titleSlug}}}` : entityName;

  // Escolhas da receita
  const [person, setPerson] = useState('');
  const [field, setField] = useState(statusField && statusFields.some((f) => f.slug === statusField) ? statusField : '');
  const [value, setValue] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [dateField, setDateField] = useState('');
  const [url, setUrl] = useState('');
  const [when, setWhen] = useState<'ON_CREATE' | 'ON_UPDATE'>('ON_CREATE');

  const sf = statusFields.find((f) => f.slug === (field || statusFields[0]?.slug));
  const statusSlug = sf?.slug ?? '';
  const statusOptions = optionsOf(sf);
  const chosenValue = value || statusOptions[0]?.value || '';
  const chosenLabel = statusOptions.find((o) => o.value === chosenValue)?.label ?? chosenValue;
  const personName = team?.find((m) => m.id === person)?.name;
  // Assunto e mensagem acompanham a situacao escolhida ate a pessoa editar
  const emailSubject = subject || `${entityName} ${recordName}: ${chosenLabel}`;
  const emailBody = body || `Olá,\n\nAvisamos que ${entityName.toLowerCase()} ${recordName} está agora como "${chosenLabel}".\n\nQualquer dúvida, é só responder este e-mail.`;

  const reset = () => {
    setRecipe(null); setPerson(''); setValue(''); setEmailTo(''); setSubject(''); setBody(''); setDateField(''); setUrl('');
  };
  const close = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  const pick = (key: RecipeKey) => {
    setRecipe(key);
    if (key === 'email-status') setEmailTo(emailFields[0] ? `{{record.${emailFields[0].slug}}}` : '');
  };

  // Trigger "quando a situacao mudar para X" (booleano vai como booleano)
  const statusTrigger = () => ({
    trigger: 'ON_FIELD_CHANGE' as const,
    triggerConfig: { fieldSlug: statusSlug, toValue: sf?.type === 'boolean' ? chosenValue === 'true' : chosenValue },
  });

  const build = (): { data: CreateAutomationData; sentence: string } | null => {
    switch (recipe) {
      case 'notify-new':
        if (!person) return null;
        return {
          sentence: `Quando um(a) ${entityName.toLowerCase()} for criado(a), avisar ${personName}.`,
          data: {
            name: `Avisar ${personName} sobre novo(a) ${entityName.toLowerCase()}`,
            trigger: 'ON_CREATE',
            actions: [{ order: 0, type: 'notify_user', config: { userId: person, title: `Novo(a) ${entityName.toLowerCase()}`, message: `${recordName} foi criado(a) por {{user.name}}`, type: 'info' } }],
          },
        };
      case 'notify-status':
        if (!person || !statusSlug) return null;
        return {
          sentence: `Quando ${sf?.label || sf?.name} mudar para "${chosenLabel}", avisar ${personName}.`,
          data: {
            name: `Avisar ${personName}: ${entityName.toLowerCase()} "${chosenLabel}"`,
            ...statusTrigger(),
            actions: [{ order: 0, type: 'notify_user', config: { userId: person, title: `${entityName}: ${chosenLabel}`, message: `${recordName} mudou para "${chosenLabel}" (por {{user.name}})`, type: 'info' } }],
          },
        };
      case 'email-status':
        if (!statusSlug || !emailTo.trim() || !emailSubject.trim()) return null;
        return {
          sentence: `Quando ${sf?.label || sf?.name} mudar para "${chosenLabel}", mandar e-mail.`,
          data: {
            name: `E-mail quando ${entityName.toLowerCase()} ficar "${chosenLabel}"`,
            ...statusTrigger(),
            actions: [{ order: 0, type: 'send_email', config: { to: emailTo.trim(), subject: emailSubject.trim(), body: emailBody } }],
          },
        };
      case 'fill-date': {
        const df = dateFields.find((f) => f.slug === (dateField || dateFields[0]?.slug));
        if (!statusSlug || !df) return null;
        return {
          sentence: `Quando ${sf?.label || sf?.name} mudar para "${chosenLabel}", preencher ${df.label || df.name} com ${df.type === 'date' ? 'a data de hoje' : 'a data e hora do momento'}.`,
          data: {
            name: `${df.label || df.name} automático ao ficar "${chosenLabel}"`,
            ...statusTrigger(),
            actions: [{ order: 0, type: 'update_field', config: { fieldSlug: df.slug, value: df.type === 'date' ? '{{today}}' : '{{now}}' } }],
          },
        };
      }
      case 'webhook': {
        if (!/^https:\/\/\S+$/.test(url.trim())) return null;
        return {
          sentence: `Quando um(a) ${entityName.toLowerCase()} for ${when === 'ON_CREATE' ? 'criado(a)' : 'alterado(a)'}, enviar os dados para ${url.trim()}.`,
          data: {
            name: `Enviar ${entityName.toLowerCase()} para outro sistema`,
            trigger: when,
            actions: [{
              order: 0, type: 'call_webhook',
              config: { url: url.trim(), method: 'POST', retries: 2, body: { evento: when === 'ON_CREATE' ? 'criado' : 'alterado', tabela: '{{entity.name}}', id: '{{recordId}}', por: '{{user.name}}', registro: '{{record}}' } },
            }],
          },
        };
      }
      default:
        return null;
    }
  };

  const built = build();
  const save = async () => {
    if (!built) return;
    await create.mutateAsync({ ...built.data, isActive: true, errorHandling: 'stop' });
    close(false);
  };

  const needsStatus = recipe === 'notify-status' || recipe === 'email-status' || recipe === 'fill-date';
  const missing =
    needsStatus && statusFields.length === 0 ? 'Esta tabela ainda não tem um campo de situação (Lista de opções ou Sim/Não).'
      : recipe === 'fill-date' && dateFields.length === 0 ? 'Esta tabela não tem campo de data para preencher.'
        : null;

  const personSelect = (
    <div className="space-y-1.5">
      <Label>Quem recebe o aviso</Label>
      <Select value={person} onChange={setPerson} testId="recipe-person">
        <option value="">Escolha a pessoa...</option>
        {(team || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </Select>
      <p className="text-xs text-muted-foreground">O aviso aparece no sino e no app da pessoa.</p>
    </div>
  );

  const statusPicker = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Quando o campo</Label>
        <Select value={statusSlug} onChange={(v) => { setField(v); setValue(''); }} testId="recipe-status-field">
          {statusFields.map((f) => <option key={f.slug} value={f.slug}>{f.label || f.name}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>mudar para</Label>
        <Select value={chosenValue} onChange={setValue} testId="recipe-status-value">
          {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="automation-recipes">
        {!recipe ? (
          <>
            <DialogTitle className="text-lg">O que você quer automatizar?</DialogTitle>
            <DialogDescription>Escolha uma das ideias abaixo. Você completa em poucos cliques.</DialogDescription>
            <div className="mt-2 grid gap-2">
              {RECIPES.map(({ key, icon: Icon, title, example }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => pick(key)}
                  data-testid={`recipe-${key}`}
                  className="flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-nav-active/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-nav-active text-nav-active-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-xs text-muted-foreground">{example}</span>
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => { close(false); onCustom(); }}
                data-testid="recipe-custom"
                className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <Wrench className="h-4 w-4" /> Montar do zero (todas as opções, para quem já conhece)
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRecipe(null)} aria-label="Voltar">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="text-base">{RECIPES.find((r) => r.key === recipe)?.title}</DialogTitle>
            </div>
            <DialogDescription className="sr-only">Complete as escolhas e crie a automação.</DialogDescription>

            {missing ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{missing} Crie o campo na aba Campos e volte aqui.</p>
            ) : (
              <div className="space-y-4">
                {needsStatus && statusPicker}
                {(recipe === 'notify-new' || recipe === 'notify-status') && personSelect}

                {recipe === 'email-status' && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Para quem</Label>
                      <Select
                        value={emailFields.some((f) => emailTo === `{{record.${f.slug}}}`) ? emailTo : '__fixed__'}
                        onChange={(v) => setEmailTo(v === '__fixed__' ? '' : v)}
                        testId="recipe-email-to"
                      >
                        {emailFields.map((f) => <option key={f.slug} value={`{{record.${f.slug}}}`}>O e-mail do campo &quot;{f.label || f.name}&quot;</option>)}
                        <option value="__fixed__">Um endereço fixo...</option>
                      </Select>
                      {!emailFields.some((f) => emailTo === `{{record.${f.slug}}}`) && (
                        <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="Ex.: financeiro@suaempresa.com.br" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Assunto</Label>
                      <BindingTextInput value={emailSubject} onChange={setSubject} fields={own} tokenPrefix="record." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Mensagem</Label>
                      <BindingTextInput multiline rows={6} value={emailBody} onChange={setBody} fields={own} tokenPrefix="record." />
                      <p className="text-xs text-muted-foreground">
                        O envio usa o e-mail configurado da plataforma; sem ele, a mensagem fica só registrada no histórico.
                      </p>
                    </div>
                  </>
                )}

                {recipe === 'fill-date' && (
                  <div className="space-y-1.5">
                    <Label>Preencher a data</Label>
                    <Select value={dateField || dateFields[0]?.slug || ''} onChange={setDateField} testId="recipe-date-field">
                      {dateFields.map((f) => <option key={f.slug} value={f.slug}>{f.label || f.name}</option>)}
                    </Select>
                  </div>
                )}

                {recipe === 'webhook' && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Quando</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['ON_CREATE', 'ON_UPDATE'] as const).map((w) => (
                          <button key={w} type="button" aria-pressed={when === w} onClick={() => setWhen(w)}
                            className={cn('rounded-md border px-3 py-2 text-sm', when === w ? 'border-primary bg-nav-active font-medium' : 'hover:bg-muted')}>
                            {w === 'ON_CREATE' ? 'For criado' : 'For alterado'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Endereço do outro sistema</Label>
                      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.zapier.com/..." data-testid="recipe-url" />
                      <p className="text-xs text-muted-foreground">O sistema de destino informa esse endereço (começa com https://). Vão todos os dados do registro.</p>
                    </div>
                  </>
                )}

                {built && (
                  <p className="rounded-lg bg-muted/60 p-3 text-sm" data-testid="recipe-sentence">
                    <span className="text-muted-foreground">Vai funcionar assim: </span>{built.sentence}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => close(false)}>Cancelar</Button>
              <Button onClick={save} disabled={!built || !!missing || create.isPending} data-testid="recipe-save">
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar automação
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
