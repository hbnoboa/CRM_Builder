import type { EntityField } from '@/types';
import type { EntityAutomation } from '@/services/entity-automation.service';

type Option = { value: string; label: string };

const fieldName = (fields: EntityField[], slug?: unknown) => {
  const f = fields.find((x) => x.slug === slug);
  return f ? f.label || f.name || f.slug : String(slug ?? '');
};

const optionLabel = (fields: EntityField[], slug: unknown, value: unknown) => {
  const f = fields.find((x) => x.slug === slug);
  if (f?.type === 'boolean') return value === true || value === 'true' ? 'Sim' : 'Não';
  const opt = ((f?.options || []) as Array<string | Option>).find((o) => (typeof o === 'string' ? o : o.value) === value);
  return opt ? (typeof opt === 'string' ? opt : opt.label) : String(value);
};

/** Troca {{record.campo}} pelo nome do campo, para a frase ficar legivel. */
const humanize = (text: string, fields: EntityField[]) =>
  text.replace(/\{\{\s*record\.([^}]+?)\s*\}\}/g, (_, slug: string) => `[${fieldName(fields, slug)}]`)
    .replace(/\{\{\s*user\.name\s*\}\}/g, '[quem fez]')
    .replace(/\{\{\s*(now|today)\s*\}\}/g, 'a data do momento');

/** "Quando ..." da automacao, em portugues simples. */
export function describeTrigger(a: Pick<EntityAutomation, 'trigger' | 'triggerConfig'>, fields: EntityField[], entityName: string): string {
  const cfg = a.triggerConfig || {};
  switch (a.trigger) {
    case 'ON_CREATE': return `Quando um(a) ${entityName.toLowerCase()} for criado(a)`;
    case 'ON_UPDATE': return `Quando um(a) ${entityName.toLowerCase()} for alterado(a)`;
    case 'ON_DELETE': return `Quando um(a) ${entityName.toLowerCase()} for excluído(a)`;
    case 'ON_STATUS_CHANGE': return 'Quando a situação mudar';
    case 'ON_FIELD_CHANGE':
      return cfg.toValue !== undefined
        ? `Quando ${fieldName(fields, cfg.fieldSlug)} mudar para "${optionLabel(fields, cfg.fieldSlug, cfg.toValue)}"`
        : `Quando ${fieldName(fields, cfg.fieldSlug)} mudar`;
    case 'MANUAL': return 'Quando alguém clicar no botão';
    case 'SCHEDULE': return 'No horário agendado';
    default: return String(a.trigger);
  }
}

/** "... então ..." de cada acao. `people` traduz id de usuario em nome. */
export function describeAction(action: EntityAutomation['actions'][number], fields: EntityField[], people: Map<string, string>): string {
  const c = action.config || {};
  switch (action.type) {
    case 'notify_user': return `avisar ${c.userId ? people.get(String(c.userId)) ?? 'uma pessoa' : 'quem fez a alteração'}`;
    case 'send_email': return `enviar e-mail para ${humanize(String(c.to || 'quem fez a alteração'), fields)}`;
    case 'update_field': return `preencher ${fieldName(fields, c.fieldSlug)} com ${humanize(String(c.value ?? ''), fields)}`;
    case 'change_status': return `mudar ${fieldName(fields, c.statusField || 'status')} para "${optionLabel(fields, c.statusField || 'status', c.newStatus)}"`;
    case 'call_webhook': {
      let host = String(c.url || '');
      try { host = new URL(host).host; } catch { /* mantem o texto */ }
      return `enviar os dados para ${host || 'outro sistema'}`;
    }
    case 'create_record': return 'criar um registro';
    case 'wait': return 'esperar';
    case 'lookup_record': return 'buscar um registro';
    case 'update_related_record': return 'atualizar um registro ligado';
    case 'aggregate_records': return 'somar ou contar registros';
    default: return action.type;
  }
}

type Describable = Pick<EntityAutomation, 'trigger'> & Partial<Pick<EntityAutomation, 'triggerConfig' | 'conditions' | 'actions'>>;

export function describeAutomation(a: Describable, fields: EntityField[], entityName: string, people: Map<string, string>) {
  const when = describeTrigger(a, fields, entityName);
  const conditions = (a.conditions || []).length;
  const then = (a.actions || []).map((x) => describeAction(x, fields, people));
  return {
    when: conditions ? `${when} (com ${conditions} ${conditions > 1 ? 'condições' : 'condição'})` : when,
    then: then.length ? then.join(', depois ') : 'nada (sem ações)',
  };
}
