import type { EntityField } from '@/types';
import { fieldKind } from './field-catalog';

/**
 * Exemplo de cada tipo de campo para a demonstracao do seletor ("?"): o campo real,
 * com opcoes de exemplo, e um valor de exemplo para mostrar como fica na lista.
 */
export interface FieldDemo {
  field: EntityField;
  /** Valor de exemplo (lista de registros). */
  sample: unknown;
  /** false = depende do servidor ou de outra tabela; mostra sem deixar mexer. */
  interactive: boolean;
  /** O que acontece na tela real quando nao da para testar aqui. */
  note?: string;
}

const STATUS = [
  { value: 'aberta', label: 'Aberta', color: '#2563eb' },
  { value: 'andamento', label: 'Em andamento', color: '#d97706' },
  { value: 'concluida', label: 'Concluída', color: '#16a34a' },
];
const ITENS = [
  { value: 'filtro', label: 'Troca de filtro' },
  { value: 'limpeza', label: 'Limpeza' },
  { value: 'gas', label: 'Carga de gás' },
];

/** Rotulo de exemplo a partir do "Ex.: ..." do catalogo (primeiro item). */
function exampleLabel(type: string): string {
  const ex = fieldKind(type).example.split(/[,/]/)[0].trim();
  return ex ? ex.charAt(0).toUpperCase() + ex.slice(1) : fieldKind(type).label;
}

export function fieldDemo(type: string): FieldDemo {
  const base = { slug: 'demo', name: exampleLabel(type), label: exampleLabel(type), type, gridColSpan: 12 } as EntityField;
  const make = (extra: Partial<EntityField>, sample: unknown, interactive = true, note?: string): FieldDemo => ({
    field: { ...base, ...extra } as EntityField, sample, interactive, note,
  });

  switch (type) {
    case 'text': return make({ placeholder: 'Ex.: ABC-1234' }, 'ABC-1234');
    case 'textarea': return make({ placeholder: 'Descreva o problema...' }, 'Ar-condicionado pingando água na sala de reuniões.');
    case 'richtext': return make({}, 'Laudo com destaques em negrito');
    case 'number': return make({}, 3);
    case 'currency': return make({}, 450);
    case 'percentage': return make({}, 15);
    case 'rating': return make({}, 4);
    case 'slider': return make({ min: 0, max: 100, step: 5 }, 60);
    case 'select': case 'radio-group': return make({ options: STATUS }, 'andamento');
    case 'multiselect': case 'checkbox-group': return make({ options: ITENS }, ['filtro', 'limpeza']);
    case 'tags': return make({}, ['urgente', 'garantia']);
    case 'boolean': return make({}, true);
    case 'color': return make({}, '#2563eb');
    case 'date': return make({}, new Date().toISOString().slice(0, 10));
    case 'datetime': return make({}, new Date().toISOString());
    case 'time': return make({}, '14:30');
    case 'phone': return make({}, '(11) 98765-4321');
    case 'email': return make({}, 'cliente@exemplo.com');
    case 'cpf': return make({}, '123.456.789-09');
    case 'cnpj': return make({}, '12.345.678/0001-95');
    case 'cep': return make({}, '01310-100');
    case 'url': return make({}, 'https://exemplo.com.br');
    case 'section-title': return make({}, null);
    case 'signature': return make({}, null, true, 'No celular a pessoa assina com o dedo; no PDF a assinatura aparece como imagem.');
    case 'password': return make({}, '••••••');
    case 'array': return make({}, ['SN-001', 'SN-002']);
    case 'image': return make({}, null, false, 'Na tela real abre a câmera do celular ou a galeria. As fotos aparecem em miniatura no registro e no PDF.');
    case 'file': return make({}, null, false, 'Na tela real abre a escolha de arquivo (PDF, planilha, documento). O arquivo fica guardado no registro.');
    case 'map': return make({}, null, false, 'Na tela real aparece um mapa para marcar o ponto; pelo celular dá para usar a localização atual.');
    case 'relation': return make({}, 'Padaria Bom Pão', false, 'Na tela real abre uma busca nos registros da outra tabela (ex.: escolher o cliente da OS).');
    case 'sub-entity': return make({}, null, false, 'Na tela real aparece uma lista de itens dentro do registro, com botão para adicionar (ex.: peças da OS).');
    case 'lookup': return make({}, null, false, 'Ao escolher um registro, copia dados dele para este (ex.: o endereço do cliente escolhido).');
    case 'user-select': return make({}, 'Rogério Nunes', false, 'Na tela real lista as pessoas da equipe da empresa.');
    case 'api-select': return make({}, 'Produto 123', false, 'As opções vêm de outro sistema ligado à empresa.');
    case 'formula': return make({}, 1350, false, 'É calculado sozinho a partir de outros campos; ninguém digita.');
    case 'rollup': return make({}, 3, false, 'Soma ou conta os itens de uma lista dentro do registro.');
    case 'workflow-status': return make({}, 'Em andamento', false, 'Mostra a etapa atual e só deixa avançar para as etapas permitidas.');
    case 'timer': return make({}, '00:42:10', false, 'Botões de iniciar, pausar e parar; o tempo fica salvo no registro.');
    case 'sla-status': return make({}, 'No prazo', false, 'Mostra se o registro está dentro do prazo de atendimento.');
    case 'action-button': return make({}, null, false, 'Um botão no formulário que executa uma ação configurada (ex.: enviar para aprovação).');
    case 'zone-diagram': return make({}, null, false, 'Uma imagem com áreas para marcar (ex.: onde está a avaria no carro).');
    case 'json': case 'hidden': return make({}, null, false, 'Não aparece para quem preenche; serve para integrações.');
    default: return make({}, null, false);
  }
}
