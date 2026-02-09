// ============================================================================
// PAGE EVENTS & ACTIONS SYSTEM
// ============================================================================

// Tipos de eventos disponiveis por tipo de componente
export type EventType =
  | 'onClick'      // Botoes, links
  | 'onChange'     // Selects, inputs
  | 'onSubmit'     // Forms
  | 'onLoad'       // Qualquer componente
  | 'onSuccess'    // Apos API sucesso
  | 'onError';     // Apos API erro

// Tipos de acoes disponiveis
export type ActionType =
  | 'callApi'       // Chamar uma API (CRUD ou custom)
  | 'setValue'      // Setar valor de outro campo
  | 'filterData'    // Filtrar dados de outro componente
  | 'navigate'      // Navegar para outra pagina
  | 'showToast'     // Mostrar notificacao
  | 'showModal'     // Abrir modal
  | 'closeModal'    // Fechar modal
  | 'refresh'       // Atualizar dados de um componente
  | 'setVisibility' // Mostrar/esconder componente
  | 'setLoading'    // Setar estado de loading
  | 'runActions';   // Executar outro grupo de acoes (para reuso)

// Configuracao de uma acao
export interface Action {
  id: string;
  type: ActionType;
  label?: string; // Nome amigavel para identificar a acao

  // Para callApi
  apiType?: 'crud' | 'custom';
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  apiPath?: string; // Ex: /api/cliente/:id/aprovar
  apiBody?: Record<string, unknown> | string; // Pode ser objeto ou expressao
  apiHeaders?: Record<string, string>;

  // Para setValue
  targetComponentId?: string;
  targetField?: string;
  value?: unknown; // Valor fixo ou expressao como {{response.data.email}}

  // Para filterData
  filterComponentId?: string;
  filterField?: string;
  filterValue?: string; // Expressao como {{event.value}}

  // Para navigate
  navigateTo?: string; // URL ou slug da pagina
  navigateParams?: Record<string, string>;
  openInNewTab?: boolean;

  // Para showToast
  toastType?: 'success' | 'error' | 'warning' | 'info';
  toastMessage?: string;
  toastDuration?: number;

  // Para showModal / closeModal
  modalId?: string;
  modalTitle?: string;
  modalContent?: string;

  // Para refresh
  refreshComponentId?: string;

  // Para setVisibility
  visibilityComponentId?: string;
  visibilityAction?: 'show' | 'hide' | 'toggle';

  // Para setLoading
  loadingComponentId?: string;
  loadingState?: boolean;

  // Para runActions
  actionsGroupId?: string;

  // Controle de execucao
  condition?: string; // Expressao condicional: {{response.success}} === true
  delay?: number; // Delay em ms antes de executar
  async?: boolean; // Se true, nao espera terminar para executar proxima

  // Acoes aninhadas (para onSuccess/onError de callApi)
  onSuccess?: Action[];
  onError?: Action[];
}

// Configuracao de um evento
export interface ComponentEvent {
  id: string;
  type: EventType;
  label?: string;
  enabled: boolean;
  actions: Action[];

  // Condicao para o evento disparar
  condition?: string;
}

// Props que todos os componentes interativos terao
export interface EventableComponentProps {
  componentId?: string; // ID unico do componente na pagina
  events?: ComponentEvent[];
}

// ============================================================================
// HELPERS
// ============================================================================

// Gera ID unico
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Cria evento vazio
export function createEmptyEvent(type: EventType): ComponentEvent {
  return {
    id: generateId(),
    type,
    enabled: true,
    actions: [],
  };
}

// Cria acao vazia
export function createEmptyAction(type: ActionType): Action {
  return {
    id: generateId(),
    type,
    label: getActionLabel(type),
  };
}

// Translation keys for event types (use with t(`pageEvents.events.${key}`))
export function getEventLabelKey(type: EventType): string {
  return type;
}

// Translation keys for action types (use with t(`pageEvents.actions.${key}`))
export function getActionLabelKey(type: ActionType): string {
  return type;
}

// Labels amigaveis para tipos de evento (with translator function)
export function getEventLabel(type: EventType, t?: (key: string) => string): string {
  if (t) {
    return t(`pageEvents.events.${type}`);
  }
  // Fallback for non-translated contexts
  const labels: Record<EventType, string> = {
    onClick: 'On Click',
    onChange: 'On Change',
    onSubmit: 'On Submit',
    onLoad: 'On Load',
    onSuccess: 'On Success',
    onError: 'On Error',
  };
  return labels[type];
}

// Labels amigaveis para tipos de acao (with translator function)
export function getActionLabel(type: ActionType, t?: (key: string) => string): string {
  if (t) {
    return t(`pageEvents.actions.${type}`);
  }
  // Fallback for non-translated contexts
  const labels: Record<ActionType, string> = {
    callApi: 'Call API',
    setValue: 'Set Value',
    filterData: 'Filter Data',
    navigate: 'Navigate',
    showToast: 'Show Toast',
    showModal: 'Open Modal',
    closeModal: 'Close Modal',
    refresh: 'Refresh Data',
    setVisibility: 'Show/Hide',
    setLoading: 'Set Loading',
    runActions: 'Run Actions',
  };
  return labels[type];
}

// Icones para tipos de acao (nome do Lucide icon)
export function getActionIcon(type: ActionType): string {
  const icons: Record<ActionType, string> = {
    callApi: 'Zap',
    setValue: 'PenLine',
    filterData: 'Filter',
    navigate: 'ExternalLink',
    showToast: 'Bell',
    showModal: 'Maximize2',
    closeModal: 'Minimize2',
    refresh: 'RefreshCw',
    setVisibility: 'Eye',
    setLoading: 'Loader2',
    runActions: 'Play',
  };
  return icons[type];
}

// Cores para tipos de acao
export function getActionColor(type: ActionType): string {
  const colors: Record<ActionType, string> = {
    callApi: 'bg-blue-500',
    setValue: 'bg-purple-500',
    filterData: 'bg-orange-500',
    navigate: 'bg-green-500',
    showToast: 'bg-yellow-500',
    showModal: 'bg-indigo-500',
    closeModal: 'bg-gray-500',
    refresh: 'bg-cyan-500',
    setVisibility: 'bg-pink-500',
    setLoading: 'bg-gray-500',
    runActions: 'bg-teal-500',
  };
  return colors[type];
}

// Eventos disponiveis por tipo de componente
export function getAvailableEvents(componentType: string): EventType[] {
  const eventsByComponent: Record<string, EventType[]> = {
    // Botoes
    Button: ['onClick', 'onLoad'],
    ActionButton: ['onClick', 'onLoad'],

    // Inputs
    TextInput: ['onChange', 'onLoad'],
    NumberInput: ['onChange', 'onLoad'],
    EmailInput: ['onChange', 'onLoad'],
    PhoneInput: ['onChange', 'onLoad'],
    TextAreaField: ['onChange', 'onLoad'],

    // Selects
    SelectField: ['onChange', 'onLoad'],

    // Forms
    Form: ['onSubmit', 'onLoad', 'onSuccess', 'onError'],

    // Outros
    DataTable: ['onLoad', 'onChange'],
    DataList: ['onLoad'],
    Card: ['onClick', 'onLoad'],
  };

  return eventsByComponent[componentType] || ['onLoad'];
}

// ============================================================================
// EXPRESSION PARSER COM SUPORTE A MATEMATICA
// ============================================================================

// Contexto disponivel para expressoes
export interface ExpressionContext {
  event?: {
    type: string;
    value?: unknown;
    target?: unknown;
  };
  response?: {
    data?: unknown;
    status?: number;
    success?: boolean;
    error?: string;
  };
  form?: Record<string, unknown>;
  page?: {
    params?: Record<string, string>;
    query?: Record<string, string>;
  };
  user?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
  components?: Record<string, unknown>; // Valores de outros componentes
}

// ============================================================================
// TOKENIZER
// ============================================================================

type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'IDENTIFIER'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'DOT';

interface Token {
  type: TokenType;
  value: string | number;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const char = expr[i];

    // Espacos
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Numeros (incluindo decimais)
    if (/\d/.test(char) || (char === '.' && /\d/.test(expr[i + 1]))) {
      let num = '';
      while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === '.')) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(num) });
      continue;
    }

    // Strings (aspas simples ou duplas)
    if (char === '"' || char === "'") {
      const quote = char;
      i++;
      let str = '';
      while (i < expr.length && expr[i] !== quote) {
        str += expr[i];
        i++;
      }
      i++; // Pula aspas final
      tokens.push({ type: 'STRING', value: str });
      continue;
    }

    // Identificadores (variaveis e funcoes)
    if (/[a-zA-Z_]/.test(char)) {
      let id = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i];
        i++;
      }
      tokens.push({ type: 'IDENTIFIER', value: id });
      continue;
    }

    // Operadores de 2 caracteres
    const twoChar = expr.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(twoChar)) {
      tokens.push({ type: 'OPERATOR', value: twoChar });
      i += 2;
      continue;
    }

    // Operadores de 1 caractere
    if (['+', '-', '*', '/', '%', '<', '>', '!'].includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char });
      i++;
      continue;
    }

    // Parenteses
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    // Virgula
    if (char === ',') {
      tokens.push({ type: 'COMMA', value: ',' });
      i++;
      continue;
    }

    // Ponto (para acesso a propriedades)
    if (char === '.') {
      tokens.push({ type: 'DOT', value: '.' });
      i++;
      continue;
    }

    // Caractere desconhecido - pula
    i++;
  }

  return tokens;
}

// ============================================================================
// PARSER & EVALUATOR
// ============================================================================

class ExpressionEvaluator {
  private tokens: Token[] = [];
  private pos = 0;
  private context: ExpressionContext;

  // Funcoes matematicas disponiveis
  private mathFunction(name: string, args: number[]): number {
    switch (name) {
      // Arredondamento
      case 'round': {
        const factor = Math.pow(10, args[1] || 0);
        return Math.round(args[0] * factor) / factor;
      }
      case 'floor': return Math.floor(args[0]);
      case 'ceil': return Math.ceil(args[0]);
      case 'trunc': return Math.trunc(args[0]);

      // Basicas
      case 'abs': return Math.abs(args[0]);
      case 'sign': return Math.sign(args[0]);

      // Min/Max
      case 'min': return Math.min(...args);
      case 'max': return Math.max(...args);

      // Potencia e raiz
      case 'pow': return Math.pow(args[0], args[1] || 2);
      case 'sqrt': return Math.sqrt(args[0]);
      case 'cbrt': return Math.cbrt(args[0]);

      // Logaritmos
      case 'log': return Math.log(args[0]);
      case 'log10': return Math.log10(args[0]);
      case 'log2': return Math.log2(args[0]);

      // Trigonometria
      case 'sin': return Math.sin(args[0]);
      case 'cos': return Math.cos(args[0]);
      case 'tan': return Math.tan(args[0]);

      // Constantes
      case 'pi': return Math.PI;
      case 'e': return Math.E;

      // Porcentagem
      case 'percent': return (args[0] / args[1]) * 100;
      case 'percentOf': return (args[0] / 100) * args[1];

      // Financeiras
      case 'discount': return args[0] * (1 - (args[1] || 0) / 100);
      case 'markup': return args[0] * (1 + (args[1] || 0) / 100);
      case 'tax': return args[0] * ((args[1] || 0) / 100);
      case 'withTax': return args[0] * (1 + (args[1] || 0) / 100);

      // Soma e media
      case 'sum': return args.reduce((a, b) => a + b, 0);
      case 'avg': return args.length > 0 ? args.reduce((a, b) => a + b, 0) / args.length : 0;

      default: return args[0] || 0;
    }
  }

  private readonly mathFunctions = new Set([
    'round', 'floor', 'ceil', 'trunc', 'abs', 'sign',
    'min', 'max', 'pow', 'sqrt', 'cbrt',
    'log', 'log10', 'log2', 'sin', 'cos', 'tan',
    'pi', 'e', 'percent', 'percentOf',
    'discount', 'markup', 'tax', 'withTax', 'sum', 'avg'
  ]);

  // Funcoes de formatacao
  private readonly formatFunctions: Record<string, (value: unknown, ...args: unknown[]) => string> = {
    currency: (value: unknown, locale = 'pt-BR', currency = 'BRL') => {
      const num = Number(value) || 0;
      return new Intl.NumberFormat(String(locale), {
        style: 'currency',
        currency: String(currency),
      }).format(num);
    },
    number: (value: unknown, decimals = 2, locale = 'pt-BR') => {
      const num = Number(value) || 0;
      return new Intl.NumberFormat(String(locale), {
        minimumFractionDigits: Number(decimals),
        maximumFractionDigits: Number(decimals),
      }).format(num);
    },
    percent: (value: unknown, decimals = 0) => {
      const num = Number(value) || 0;
      return `${num.toFixed(Number(decimals))}%`;
    },
    date: (value: unknown, format = 'short', locale = 'pt-BR') => {
      const date = value instanceof Date ? value : new Date(String(value));
      if (isNaN(date.getTime())) return '';

      const options: Intl.DateTimeFormatOptions =
        format === 'short' ? { day: '2-digit', month: '2-digit', year: 'numeric' } :
        format === 'long' ? { day: 'numeric', month: 'long', year: 'numeric' } :
        format === 'time' ? { hour: '2-digit', minute: '2-digit' } :
        format === 'datetime' ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } :
        {};

      return new Intl.DateTimeFormat(String(locale), options).format(date);
    },
    upper: (value: unknown) => String(value).toUpperCase(),
    lower: (value: unknown) => String(value).toLowerCase(),
    capitalize: (value: unknown) => {
      const str = String(value);
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
    trim: (value: unknown) => String(value).trim(),
    padStart: (value: unknown, length: unknown, char = '0') =>
      String(value).padStart(Number(length), String(char)),
    padEnd: (value: unknown, length: unknown, char = '0') =>
      String(value).padEnd(Number(length), String(char)),
  };

  // Funcoes condicionais
  private readonly conditionalFunctions: Record<string, (...args: unknown[]) => unknown> = {
    if: (condition: unknown, trueVal: unknown, falseVal: unknown) =>
      condition ? trueVal : falseVal,
    ifEmpty: (value: unknown, defaultVal: unknown) =>
      (value === null || value === undefined || value === '') ? defaultVal : value,
    ifZero: (value: unknown, defaultVal: unknown) =>
      Number(value) === 0 ? defaultVal : value,
    coalesce: (...args: unknown[]) =>
      args.find(arg => arg !== null && arg !== undefined) ?? null,
  };

  constructor(context: ExpressionContext) {
    this.context = context;
  }

  evaluate(expr: string): unknown {
    this.tokens = tokenize(expr);
    this.pos = 0;

    if (this.tokens.length === 0) return '';

    return this.parseExpression();
  }

  private current(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private peek(offset = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  // Expressao principal (menor precedencia: || )
  private parseExpression(): unknown {
    return this.parseOr();
  }

  private parseOr(): unknown {
    let left = this.parseAnd();

    while (this.current()?.value === '||') {
      this.consume();
      const right = this.parseAnd();
      left = Boolean(left) || Boolean(right);
    }

    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseEquality();

    while (this.current()?.value === '&&') {
      this.consume();
      const right = this.parseEquality();
      left = Boolean(left) && Boolean(right);
    }

    return left;
  }

  private parseEquality(): unknown {
    let left = this.parseComparison();

    while (this.current()?.value === '==' || this.current()?.value === '!=') {
      const op = this.consume().value;
      const right = this.parseComparison();
      left = op === '==' ? left == right : left != right;
    }

    return left;
  }

  private parseComparison(): unknown {
    let left = this.parseAddSub();

    while (['<', '>', '<=', '>='].includes(String(this.current()?.value))) {
      const op = this.consume().value;
      const right = this.parseAddSub();
      const l = Number(left);
      const r = Number(right);
      switch (op) {
        case '<': left = l < r; break;
        case '>': left = l > r; break;
        case '<=': left = l <= r; break;
        case '>=': left = l >= r; break;
      }
    }

    return left;
  }

  private parseAddSub(): unknown {
    let left = this.parseMulDiv();

    while (this.current()?.value === '+' || this.current()?.value === '-') {
      const op = this.consume().value;
      const right = this.parseMulDiv();

      // Suporta concatenacao de strings com +
      if (op === '+' && (typeof left === 'string' || typeof right === 'string')) {
        left = String(left) + String(right);
      } else {
        left = op === '+' ? Number(left) + Number(right) : Number(left) - Number(right);
      }
    }

    return left;
  }

  private parseMulDiv(): unknown {
    let left = this.parseUnary();

    while (['*', '/', '%'].includes(String(this.current()?.value))) {
      const op = this.consume().value;
      const right = this.parseUnary();
      const l = Number(left);
      const r = Number(right);
      switch (op) {
        case '*': left = l * r; break;
        case '/': left = r !== 0 ? l / r : 0; break;
        case '%': left = l % r; break;
      }
    }

    return left;
  }

  private parseUnary(): unknown {
    if (this.current()?.value === '-') {
      this.consume();
      return -Number(this.parseUnary());
    }
    if (this.current()?.value === '!') {
      this.consume();
      return !this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): unknown {
    const token = this.current();

    if (!token) return undefined;

    // Numero
    if (token.type === 'NUMBER') {
      this.consume();
      return token.value;
    }

    // String
    if (token.type === 'STRING') {
      this.consume();
      return token.value;
    }

    // Parenteses
    if (token.type === 'LPAREN') {
      this.consume();
      const value = this.parseExpression();
      if (this.current()?.type === 'RPAREN') {
        this.consume();
      }
      return value;
    }

    // Identificador (variavel ou funcao)
    if (token.type === 'IDENTIFIER') {
      return this.parseIdentifier();
    }

    return undefined;
  }

  private parseIdentifier(): unknown {
    const parts: string[] = [];

    // Coleta o caminho completo (ex: response.data.items)
    while (this.current()?.type === 'IDENTIFIER') {
      parts.push(String(this.consume().value));
      if (this.current()?.type === 'DOT') {
        this.consume();
      } else {
        break;
      }
    }

    const fullPath = parts.join('.');
    const firstName = parts[0];

    // Verifica se e chamada de funcao
    if (this.current()?.type === 'LPAREN') {
      return this.parseFunctionCall(fullPath);
    }

    // Valores booleanos
    if (fullPath === 'true') return true;
    if (fullPath === 'false') return false;
    if (fullPath === 'null') return null;

    // Busca valor no contexto
    return this.getContextValue(fullPath);
  }

  private parseFunctionCall(name: string): unknown {
    this.consume(); // Consome (

    const args: unknown[] = [];

    while (this.current() && this.current()?.type !== 'RPAREN') {
      args.push(this.parseExpression());
      if (this.current()?.type === 'COMMA') {
        this.consume();
      }
    }

    if (this.current()?.type === 'RPAREN') {
      this.consume();
    }

    // Tenta funcao matematica
    if (this.mathFunctions.has(name)) {
      return this.mathFunction(name, args.map(Number));
    }

    // Tenta funcao de formatacao
    if (name in this.formatFunctions) {
      return this.formatFunctions[name](args[0], args[1], args[2]);
    }

    // Tenta funcao condicional
    if (name in this.conditionalFunctions) {
      return this.conditionalFunctions[name](args[0], args[1], args[2], args[3]);
    }

    return undefined;
  }

  private getContextValue(path: string): unknown {
    const parts = path.split('.');
    let current: unknown = this.context;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}

// ============================================================================
// FUNCOES PUBLICAS
// ============================================================================

/**
 * Avalia uma expressao com suporte a:
 * - Variaveis: {{response.data.email}}
 * - Matematica: {{form.preco * form.quantidade}}
 * - Funcoes: {{round(form.total, 2)}}
 * - Formatacao: {{currency(form.valor)}}
 * - Condicoes: {{if(form.ativo, 'Sim', 'Nao')}}
 */
export function evaluateExpression(expression: string, context: ExpressionContext): unknown {
  if (!expression) return expression;

  // Se nao contem {{, retorna como esta
  if (!expression.includes('{{')) return expression;

  const evaluator = new ExpressionEvaluator(context);

  // Verifica se a expressao inteira e uma unica expressao
  // Ex: "{{form.preco * 2}}" vs "Total: {{form.total}}"
  const singleExprMatch = expression.match(/^\{\{(.+)\}\}$/);
  if (singleExprMatch) {
    try {
      return evaluator.evaluate(singleExprMatch[1].trim());
    } catch {
      return '';
    }
  }

  // Substitui todas as expressoes {{...}} em uma string
  return expression.replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
    try {
      const value = evaluator.evaluate(expr.trim());
      return value !== undefined && value !== null ? String(value) : '';
    } catch {
      return '';
    }
  });
}

/**
 * Avalia uma condicao e retorna boolean
 * Ex: "{{response.success}} == true"
 * Ex: "{{form.valor}} > 100"
 */
export function evaluateCondition(condition: string, context: ExpressionContext): boolean {
  if (!condition) return true;

  try {
    const result = evaluateExpression(condition, context);
    return Boolean(result);
  } catch {
    return false;
  }
}

/**
 * Formata um valor como moeda
 */
export function formatCurrency(value: number, locale = 'pt-BR', currency = 'BRL'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Formata um valor como numero
 */
export function formatNumber(value: number, decimals = 2, locale = 'pt-BR'): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formata um valor como porcentagem
 */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}
