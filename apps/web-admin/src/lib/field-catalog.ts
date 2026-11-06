import {
  AlignLeft, AtSign, Building2, Calculator, Calendar, CalendarClock, CheckSquare, CircleDot, Clock, Code2,
  Contact, DollarSign, EyeOff, FileText, FolderTree, Gauge, Hash, Heading, Image, Link2, List, ListChecks,
  Lock, MapPin, Paperclip, Palette, Percent, Phone, PenLine, Play, Search, SlidersHorizontal, Star, Tags,
  Timer, ToggleLeft, Type, User, Workflow, Zap, Globe, Sigma, LayoutGrid, Mailbox,
  type LucideIcon,
} from 'lucide-react';

export interface FieldKind {
  type: string;
  label: string;
  /** Para que serve, em uma frase simples. */
  description: string;
  /** Exemplo de uso que a pessoa reconhece. */
  example: string;
  icon: LucideIcon;
  group: FieldGroupKey;
}

export type FieldGroupKey = 'basic' | 'choice' | 'date' | 'contact' | 'files' | 'links' | 'layout' | 'advanced';

export const FIELD_GROUPS: Array<{ key: FieldGroupKey; label: string }> = [
  { key: 'basic', label: 'Textos e números' },
  { key: 'choice', label: 'Escolhas' },
  { key: 'date', label: 'Datas e horas' },
  { key: 'contact', label: 'Contato e documentos' },
  { key: 'files', label: 'Fotos, arquivos e assinatura' },
  { key: 'links', label: 'Ligar com outras tabelas' },
  { key: 'layout', label: 'Organizar o formulário' },
  { key: 'advanced', label: 'Avançado' },
];

/** Os tipos que quase toda tabela usa: aparecem primeiro no seletor. */
export const POPULAR_FIELD_TYPES = ['text', 'select', 'date', 'number', 'currency', 'phone', 'textarea', 'image', 'boolean', 'user-select'];

export const FIELD_KINDS: FieldKind[] = [
  // Textos e numeros
  { type: 'text', label: 'Texto curto', description: 'Uma linha de texto.', example: 'Nome, placa, modelo', icon: Type, group: 'basic' },
  { type: 'textarea', label: 'Texto longo', description: 'Várias linhas para descrever algo.', example: 'Observações, descrição do problema', icon: AlignLeft, group: 'basic' },
  { type: 'number', label: 'Número', description: 'Quantidade ou medida.', example: 'Quantidade, km rodados', icon: Hash, group: 'basic' },
  { type: 'currency', label: 'Valor em dinheiro', description: 'Mostra com R$ e centavos.', example: 'Preço, valor do serviço', icon: DollarSign, group: 'basic' },
  { type: 'percentage', label: 'Porcentagem', description: 'Número com %.', example: 'Desconto, comissão', icon: Percent, group: 'basic' },
  { type: 'rating', label: 'Nota em estrelas', description: 'De 1 a 5 estrelas.', example: 'Avaliação do cliente', icon: Star, group: 'basic' },
  { type: 'slider', label: 'Régua deslizante', description: 'Escolher um número arrastando.', example: 'Nível do tanque', icon: SlidersHorizontal, group: 'basic' },
  { type: 'richtext', label: 'Texto formatado', description: 'Texto com negrito, listas e títulos.', example: 'Laudo, parecer', icon: FileText, group: 'basic' },

  // Escolhas
  { type: 'select', label: 'Lista de opções', description: 'Escolher uma opção, com cor se quiser.', example: 'Situação, prioridade, tipo', icon: CircleDot, group: 'choice' },
  { type: 'multiselect', label: 'Várias opções', description: 'Marcar mais de uma opção da lista.', example: 'Serviços feitos, itens', icon: ListChecks, group: 'choice' },
  { type: 'boolean', label: 'Sim ou não', description: 'Uma chave liga/desliga.', example: 'Pago? Tem garantia?', icon: ToggleLeft, group: 'choice' },
  { type: 'radio-group', label: 'Botões de escolha', description: 'Uma opção, todas à vista.', example: 'Conforme / Não conforme', icon: CircleDot, group: 'choice' },
  { type: 'checkbox-group', label: 'Caixas de marcar', description: 'Várias opções, todas à vista.', example: 'Checklist de itens', icon: CheckSquare, group: 'choice' },
  { type: 'tags', label: 'Etiquetas', description: 'Palavras livres para agrupar.', example: 'Marcadores, temas', icon: Tags, group: 'choice' },
  { type: 'color', label: 'Cor', description: 'Escolher uma cor.', example: 'Cor do veículo', icon: Palette, group: 'choice' },

  // Datas
  { type: 'date', label: 'Data', description: 'Dia, mês e ano.', example: 'Data da visita, vencimento', icon: Calendar, group: 'date' },
  { type: 'datetime', label: 'Data e hora', description: 'Dia e horário.', example: 'Início do atendimento', icon: CalendarClock, group: 'date' },
  { type: 'time', label: 'Hora', description: 'Só o horário.', example: 'Hora de chegada', icon: Clock, group: 'date' },

  // Contato e documentos
  { type: 'phone', label: 'Telefone', description: 'Com DDD e máscara.', example: 'Celular, WhatsApp', icon: Phone, group: 'contact' },
  { type: 'email', label: 'E-mail', description: 'Confere se o e-mail é válido.', example: 'E-mail do cliente', icon: AtSign, group: 'contact' },
  { type: 'cpf', label: 'CPF', description: 'Com máscara e conferência.', example: 'CPF do cliente', icon: Contact, group: 'contact' },
  { type: 'cnpj', label: 'CNPJ', description: 'Com máscara e conferência.', example: 'CNPJ da empresa', icon: Building2, group: 'contact' },
  { type: 'cep', label: 'CEP', description: 'Com máscara de CEP.', example: 'CEP do endereço', icon: Mailbox, group: 'contact' },
  { type: 'url', label: 'Link (site)', description: 'Endereço de página na internet.', example: 'Site, Instagram', icon: Globe, group: 'contact' },
  { type: 'map', label: 'Localização no mapa', description: 'Marca um ponto no mapa.', example: 'Local da obra', icon: MapPin, group: 'contact' },

  // Arquivos
  { type: 'image', label: 'Foto', description: 'Tirar ou enviar fotos.', example: 'Foto antes/depois', icon: Image, group: 'files' },
  { type: 'file', label: 'Arquivo', description: 'Enviar PDF, planilha, documento.', example: 'Nota fiscal, contrato', icon: Paperclip, group: 'files' },
  { type: 'signature', label: 'Assinatura', description: 'Assinar com o dedo na tela.', example: 'Assinatura do cliente', icon: PenLine, group: 'files' },

  // Ligacoes
  { type: 'relation', label: 'Escolher de outra tabela', description: 'Liga a um registro de outra tabela.', example: 'Cliente da ordem de serviço', icon: Link2, group: 'links' },
  { type: 'sub-entity', label: 'Lista de itens dentro', description: 'Vários itens dentro deste registro.', example: 'Itens da OS, visitas do cliente', icon: FolderTree, group: 'links' },
  { type: 'user-select', label: 'Pessoa da equipe', description: 'Escolher um usuário da empresa.', example: 'Responsável, técnico', icon: User, group: 'links' },
  { type: 'lookup', label: 'Buscar e copiar dados', description: 'Puxa dados de outra tabela.', example: 'Endereço do cliente escolhido', icon: Search, group: 'links' },

  // Layout
  { type: 'section-title', label: 'Título de seção', description: 'Separa o formulário em partes.', example: 'Dados do cliente, Fotos', icon: Heading, group: 'layout' },
  { type: 'zone-diagram', label: 'Desenho com áreas', description: 'Marcar áreas numa imagem.', example: 'Avarias no carro', icon: LayoutGrid, group: 'layout' },

  // Avancado
  { type: 'formula', label: 'Cálculo automático', description: 'Calcula a partir de outros campos.', example: 'Total = quantidade × preço', icon: Calculator, group: 'advanced' },
  { type: 'rollup', label: 'Soma dos itens', description: 'Soma ou conta itens de uma lista.', example: 'Total dos itens da OS', icon: Sigma, group: 'advanced' },
  { type: 'workflow-status', label: 'Etapas com regras', description: 'Situação com passos permitidos.', example: 'Aberta → Em andamento → Concluída', icon: Workflow, group: 'advanced' },
  { type: 'timer', label: 'Cronômetro', description: 'Conta o tempo de execução.', example: 'Tempo de atendimento', icon: Timer, group: 'advanced' },
  { type: 'sla-status', label: 'Prazo de atendimento (SLA)', description: 'Mostra se está no prazo.', example: 'Resposta em 24h', icon: Gauge, group: 'advanced' },
  { type: 'action-button', label: 'Botão de ação', description: 'Executa uma ação ao clicar.', example: 'Enviar para aprovação', icon: Play, group: 'advanced' },
  { type: 'api-select', label: 'Lista de outro sistema', description: 'Opções vindas de uma integração.', example: 'Produtos do ERP', icon: Zap, group: 'advanced' },
  { type: 'array', label: 'Lista de textos', description: 'Vários textos curtos.', example: 'Números de série', icon: List, group: 'advanced' },
  { type: 'password', label: 'Senha', description: 'Texto escondido.', example: 'Senha do equipamento', icon: Lock, group: 'advanced' },
  { type: 'json', label: 'Dados técnicos (JSON)', description: 'Para integrações.', example: 'Resposta de API', icon: Code2, group: 'advanced' },
  { type: 'hidden', label: 'Campo oculto', description: 'Guarda um valor sem mostrar.', example: 'Código de integração', icon: EyeOff, group: 'advanced' },
];

const BY_TYPE = new Map(FIELD_KINDS.map((k) => [k.type, k]));

export function fieldKind(type: string): FieldKind {
  return BY_TYPE.get(type) ?? { type, label: type, description: '', example: '', icon: Type, group: 'advanced' };
}
