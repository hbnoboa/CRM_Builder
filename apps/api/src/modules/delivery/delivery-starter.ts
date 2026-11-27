/**
 * Modelo "Central de pedidos de delivery" (iFood, 99Food e balcao, varias lojas),
 * montado pelo construtor da tela inicial (mesmo rascunho, historico e permissoes).
 * Nomes de campo fixos: o conector e o simulador gravam por eles.
 */

export const DEFAULT_STORES = [
  'Loja Centro', 'Loja Zona Norte', 'Loja Zona Sul', 'Loja Shopping',
  'Loja Distrito Industrial', 'Loja Universidade', 'Loja Rodoviária',
];

export const ORDER_STATUS = ['Novo', 'Aceito', 'Em preparo', 'Saiu para entrega', 'Entregue', 'Cancelado'] as const;
export const ORDER_APPS = ['iFood', '99Food', 'Balcão'] as const;
export const PAYMENTS = ['Pago no app', 'Dinheiro na entrega', 'Cartão na entrega'] as const;

/** Ajuda do campo "Código de entrega" (central nova e campo incluido nas centrais antigas). */
export const DELIVERY_CODE_HELP =
  'Pedido do iFood com entrega própria: o código que o cliente informa ao receber. Com ele, o pedido é concluído no iFood na hora; sem ele, o iFood conclui quando o cliente confirmar no app.';

/** Campo do rascunho do construtor (o mesmo formato serve para incluir em centrais antigas). */
export interface StarterField {
  key: string; label: string; type: string; width?: 'quarter' | 'third' | 'half' | 'full';
  helpText?: string; relatedTable?: string;
}

/** Campos que o cardapio do iFood preenche (entram sozinhos nas centrais antigas). */
export const MENU_APP_FIELDS: StarterField[] = [
  { key: 'loja', label: 'Loja', type: 'relation', relatedTable: 'lojas', width: 'half', helpText: 'A loja que vende o item. Itens que vêm do iFood já chegam com a loja.' },
  { key: 'codigo_app', label: 'Código no app', type: 'text', width: 'quarter', helpText: 'O código do item no iFood. Preenchido pela importação do cardápio; não mude.' },
  { key: 'codigo_externo', label: 'Código PDV', type: 'text', width: 'quarter', helpText: 'O código externo (PDV) do item no iFood, se a loja usar.' },
  { key: 'descricao', label: 'Descrição', type: 'textarea', width: 'full' },
  { key: 'complementos', label: 'Complementos', type: 'textarea', width: 'full', helpText: 'Os grupos de complementos do item, como estão no iFood.' },
  { key: 'foto', label: 'Foto', type: 'image', width: 'half' },
];

/** Item do pedido ligado ao item do cardapio (pelo codigo do item no iFood). */
export const ORDER_ITEM_MENU_FIELD: StarterField = {
  key: 'item_cardapio', label: 'Item do cardápio', type: 'relation', relatedTable: 'cardapio', width: 'half',
  helpText: 'Preenchido quando o item do pedido do iFood está no cardápio importado.',
};

export const MENU: Array<{ nome: string; categoria: string; preco: number }> = [
  { nome: 'Marmita de frango grelhado', categoria: 'Marmita', preco: 24.9 },
  { nome: 'Marmita de carne de panela', categoria: 'Marmita', preco: 27.9 },
  { nome: 'Marmita de feijoada', categoria: 'Marmita', preco: 29.9 },
  { nome: 'Marmita de strogonoff', categoria: 'Marmita', preco: 26.9 },
  { nome: 'Marmita de parmegiana', categoria: 'Marmita', preco: 31.9 },
  { nome: 'Marmita vegetariana', categoria: 'Marmita', preco: 23.9 },
  { nome: 'Marmita fit de tilápia', categoria: 'Marmita', preco: 32.9 },
  { nome: 'Refrigerante lata', categoria: 'Bebida', preco: 6.5 },
  { nome: 'Suco natural 500 ml', categoria: 'Bebida', preco: 9.9 },
  { nome: 'Água mineral', categoria: 'Bebida', preco: 4 },
  { nome: 'Pudim', categoria: 'Sobremesa', preco: 8.9 },
  { nome: 'Brownie', categoria: 'Sobremesa', preco: 9.5 },
  { nome: 'Ovo frito', categoria: 'Adicional', preco: 3.5 },
  { nome: 'Farofa extra', categoria: 'Adicional', preco: 2.5 },
];

const opt = (labels: readonly string[], colors: string[]) => labels.map((label, i) => ({ label, color: colors[i % colors.length] }));

/** Rascunho do construtor com tudo o que o modelo cria. */
export function deliveryStarterDraft(stores: string[]) {
  const storeOptions = opt(stores, ['blue', 'teal', 'violet', 'orange', 'green', 'amber', 'red', 'gray']);
  return {
    reply: '',
    group: 'Delivery',
    tables: [
      {
        key: 'lojas', name: 'Loja', namePlural: 'Lojas', description: 'Os pontos de venda e os códigos de cada um nos apps.',
        icon: 'Store', color: 'orange', titleField: 'nome',
        fields: [
          { key: 'nome', label: 'Nome', type: 'text', required: true, width: 'half' },
          { key: 'telefone', label: 'Telefone', type: 'phone', width: 'quarter' },
          { key: 'ativa', label: 'Loja ativa', type: 'boolean', width: 'quarter', helpText: 'Só marca aqui no sistema: não pausa a loja no iFood nem na 99Food.' },
          { key: 'endereco', label: 'Endereço', type: 'text', width: 'full' },
          { key: 'ifood_id', label: 'Código no iFood', type: 'text', width: 'half', helpText: 'Preenchido ao conectar a loja em Integrações → Apps conectados → iFood.' },
          { key: 'food99_id', label: 'Código na 99Food', type: 'text', width: 'half', helpText: 'Preenchido ao conectar a loja em Integrações → Apps conectados → 99Food.' },
        ],
      },
      {
        key: 'cardapio', name: 'Item do cardápio', namePlural: 'Cardápio', description: 'O que é vendido e o preço.',
        icon: 'Utensils', color: 'green', titleField: 'nome',
        fields: [
          { key: 'nome', label: 'Nome', type: 'text', required: true, width: 'half' },
          { key: 'categoria', label: 'Categoria', type: 'select', width: 'quarter', options: opt(['Marmita', 'Bebida', 'Sobremesa', 'Adicional'], ['orange', 'blue', 'violet', 'gray']) },
          { key: 'preco', label: 'Preço', type: 'currency', required: true, width: 'quarter' },
          { key: 'ativo', label: 'À venda', type: 'boolean', width: 'quarter' },
          ...MENU_APP_FIELDS,
        ],
      },
      {
        key: 'pedidos', name: 'Pedido', namePlural: 'Pedidos', description: 'Pedidos do iFood, da 99Food e do balcão, de todas as lojas.',
        icon: 'ShoppingCart', color: 'red', titleField: 'numero', statusField: 'situacao', doneOptions: ['Entregue', 'Cancelado'], deadlineField: 'entregar_ate',
        fields: [
          { key: 'numero', label: 'Número', type: 'text', required: true, width: 'quarter' },
          { key: 'app', label: 'App', type: 'select', required: true, width: 'quarter', options: opt(ORDER_APPS, ['red', 'amber', 'gray']) },
          { key: 'loja', label: 'Loja', type: 'select', required: true, width: 'quarter', options: storeOptions },
          { key: 'situacao', label: 'Situação', type: 'select', required: true, width: 'quarter', options: opt(ORDER_STATUS, ['blue', 'teal', 'amber', 'violet', 'green', 'gray']) },
          { key: 'cliente', label: 'Cliente', type: 'text', width: 'half' },
          { key: 'telefone', label: 'Telefone', type: 'phone', width: 'quarter' },
          { key: 'pagamento', label: 'Pagamento', type: 'select', width: 'quarter', options: opt(PAYMENTS, ['green', 'amber', 'blue']) },
          { key: 'endereco', label: 'Endereço de entrega', type: 'text', width: 'full' },
          { key: 'recebido_em', label: 'Recebido em', type: 'datetime', width: 'third' },
          { key: 'entregar_ate', label: 'Entregar até', type: 'datetime', width: 'third' },
          { key: 'entregue_em', label: 'Entregue em', type: 'datetime', width: 'third' },
          { key: 'total', label: 'Total', type: 'currency', width: 'quarter' },
          { key: 'taxa_entrega', label: 'Taxa de entrega', type: 'currency', width: 'quarter' },
          { key: 'codigo_app', label: 'Código no app', type: 'text', width: 'half', helpText: 'O número do pedido no iFood ou na 99Food.' },
          { key: 'observacoes', label: 'Observações do cliente', type: 'textarea' },
          {
            key: 'motivo_cancelamento', label: 'Motivo do cancelamento', type: 'textarea',
            visibleIf: { field: 'situacao', operator: 'equals', value: 'Cancelado' },
            requiredIf: { field: 'situacao', operator: 'equals', value: 'Cancelado' },
          },
          {
            key: 'codigo_entrega', label: 'Código de entrega', type: 'text', width: 'half', helpText: DELIVERY_CODE_HELP,
            visibleIf: { field: 'situacao', operator: 'equals', value: 'Entregue' },
          },
        ],
      },
      {
        key: 'itens-do-pedido', name: 'Item do pedido', namePlural: 'Itens do pedido', description: 'O que veio em cada pedido.',
        icon: 'ListChecks', color: 'teal', parentKey: 'pedidos', titleField: 'produto',
        fields: [
          { key: 'produto', label: 'Produto', type: 'text', required: true, width: 'half' },
          { key: 'quantidade', label: 'Quantidade', type: 'number', required: true, width: 'quarter' },
          { key: 'preco', label: 'Preço', type: 'currency', width: 'quarter' },
          { key: 'observacao', label: 'Observação', type: 'text', width: 'full' },
          ORDER_ITEM_MENU_FIELD,
        ],
      },
    ],
    dashboards: [
      {
        key: 'painel-novo-1', name: 'Central de pedidos', description: 'Pedidos ao vivo de todas as lojas e apps.', mainTable: 'pedidos',
        tabs: [
          { label: 'Ao vivo', rows: [[{ type: 'kanban-board', title: 'Pedidos por situação', table: 'pedidos', groupBy: 'situacao', columns: ['loja', 'app', 'total'], width: 12 }]] },
          {
            label: 'Números',
            rows: [
              [
                { type: 'kpi-card', title: 'Pedidos', table: 'pedidos', aggregation: 'count', width: 4 },
                { type: 'kpi-card', title: 'Faturamento', table: 'pedidos', aggregation: 'sum', field: 'total', width: 4 },
                { type: 'kpi-card', title: 'Ticket médio', table: 'pedidos', aggregation: 'avg', field: 'total', width: 4 },
              ],
              [
                { type: 'bar-chart', title: 'Pedidos por loja', table: 'pedidos', groupBy: 'loja', width: 6 },
                { type: 'donut-chart', title: 'Pedidos por app', table: 'pedidos', groupBy: 'app', width: 6 },
              ],
              [{ type: 'line-chart', title: 'Pedidos por dia', table: 'pedidos', dateField: 'recebido_em', days: 30, width: 12 }],
              [{ type: 'data-table', title: 'Todos os pedidos', table: 'pedidos', columns: ['numero', 'app', 'loja', 'situacao', 'cliente', 'total', 'recebido_em'], sortBy: 'recebido_em', sortOrder: 'desc', width: 12 }],
            ],
          },
        ],
      },
    ],
    pdfs: [],
    roles: [
      {
        key: 'cargo-novo-gerente', name: 'Gerente das lojas', description: 'Acompanha os pedidos de todas as lojas.',
        modules: { dashboard: 'read', data: 'full' },
        tables: [
          { table: 'pedidos', read: true, create: true, update: true, delete: false, scope: 'all' },
          { table: 'itens-do-pedido', read: true, create: true, update: true, delete: true, scope: 'all' },
          { table: 'lojas', read: true, update: true, scope: 'all' },
          { table: 'cardapio', read: true, create: true, update: true, scope: 'all' },
        ],
      },
      ...stores.map((store, i) => ({
        key: `cargo-novo-loja-${i + 1}`, name: `Atendente ${store}`, description: `Vê e atende só os pedidos da ${store}.`,
        modules: { dashboard: 'read', data: 'edit' },
        tables: [
          { table: 'pedidos', read: true, update: true, scope: 'all', filters: [{ field: 'loja', operator: 'equals', value: store }] },
          { table: 'itens-do-pedido', read: true, scope: 'all' },
          { table: 'cardapio', read: true, scope: 'all' },
        ],
      })),
    ],
    automations: [
      {
        key: 'automacao-nova-1', name: 'Marcar a hora da entrega', table: 'pedidos',
        when: { event: 'field_changed', field: 'situacao', to: 'Entregue' },
        actions: [{ type: 'set_field', field: 'entregue_em', value: '{{now}}' }],
      },
    ],
  };
}

const FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Larissa', 'Marcos', 'Natália', 'Otávio', 'Paula', 'Rafael', 'Sabrina', 'Tiago', 'Vanessa', 'William'];
const LAST = ['Souza', 'Oliveira', 'Santos', 'Lima', 'Pereira', 'Costa', 'Ferreira', 'Almeida', 'Ribeiro', 'Carvalho', 'Gomes', 'Martins'];
const STREETS = ['Rua das Flores', 'Av. Brasil', 'Rua XV de Novembro', 'Rua São José', 'Av. Independência', 'Rua das Palmeiras', 'Rua Sete de Setembro', 'Av. Getúlio Vargas'];
const NOTES = ['', '', '', 'Sem cebola, por favor.', 'Mandar talheres.', 'Tocar o interfone 12.', 'Troco para 100.', 'Arroz integral se tiver.'];

/** Dados de mentira de um pedido (o simulador e o historico de demonstracao). */
export function fakeCustomer(rand: () => number) {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  return {
    cliente: `${pick(FIRST)} ${pick(LAST)}`,
    telefone: `(11) 9${Math.floor(1000 + rand() * 8999)}-${Math.floor(1000 + rand() * 8999)}`,
    endereco: `${pick(STREETS)}, ${Math.floor(10 + rand() * 1900)}`,
    observacoes: pick(NOTES),
  };
}
