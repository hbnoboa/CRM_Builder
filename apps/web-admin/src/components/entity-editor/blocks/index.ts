import type { Editor } from 'grapesjs';

/**
 * Categorias de blocos — cada bloco cria um crm-field com o tipo correspondente.
 * O icone e renderizado como emoji/texto para simplicidade.
 */
interface BlockDef {
  id: string;
  label: string;
  icon: string;
  category: string;
  fieldType: string;
}

const BLOCKS: BlockDef[] = [
  // Texto
  { id: 'field-text', label: 'Texto', icon: 'Aa', category: 'Texto', fieldType: 'text' },
  { id: 'field-textarea', label: 'Area de texto', icon: '¶', category: 'Texto', fieldType: 'textarea' },
  { id: 'field-richtext', label: 'Texto rico', icon: '📝', category: 'Texto', fieldType: 'richtext' },
  { id: 'field-password', label: 'Senha', icon: '🔒', category: 'Texto', fieldType: 'password' },
  { id: 'field-array', label: 'Lista', icon: '📋', category: 'Texto', fieldType: 'array' },

  // Numeros
  { id: 'field-number', label: 'Numero', icon: '#', category: 'Numeros', fieldType: 'number' },
  { id: 'field-currency', label: 'Moeda', icon: 'R$', category: 'Numeros', fieldType: 'currency' },
  { id: 'field-percentage', label: 'Percentual', icon: '%', category: 'Numeros', fieldType: 'percentage' },
  { id: 'field-slider', label: 'Slider', icon: '🎚', category: 'Numeros', fieldType: 'slider' },
  { id: 'field-rating', label: 'Avaliacao', icon: '⭐', category: 'Numeros', fieldType: 'rating' },

  // Contato
  { id: 'field-email', label: 'Email', icon: '@', category: 'Contato', fieldType: 'email' },
  { id: 'field-phone', label: 'Telefone', icon: '📞', category: 'Contato', fieldType: 'phone' },
  { id: 'field-url', label: 'URL', icon: '🔗', category: 'Contato', fieldType: 'url' },

  // Documentos BR
  { id: 'field-cpf', label: 'CPF', icon: '🪪', category: 'Documentos', fieldType: 'cpf' },
  { id: 'field-cnpj', label: 'CNPJ', icon: '🏢', category: 'Documentos', fieldType: 'cnpj' },
  { id: 'field-cep', label: 'CEP', icon: '📮', category: 'Documentos', fieldType: 'cep' },

  // Datas
  { id: 'field-date', label: 'Data', icon: '📅', category: 'Data/Hora', fieldType: 'date' },
  { id: 'field-datetime', label: 'Data e hora', icon: '🕐', category: 'Data/Hora', fieldType: 'datetime' },
  { id: 'field-time', label: 'Hora', icon: '⏰', category: 'Data/Hora', fieldType: 'time' },

  // Selecao
  { id: 'field-boolean', label: 'Sim/Nao', icon: '☑', category: 'Selecao', fieldType: 'boolean' },
  { id: 'field-select', label: 'Select', icon: '▼', category: 'Selecao', fieldType: 'select' },
  { id: 'field-multiselect', label: 'Multi-select', icon: '☰', category: 'Selecao', fieldType: 'multiselect' },
  { id: 'field-checkbox-group', label: 'Checkbox Group', icon: '☑', category: 'Selecao', fieldType: 'checkbox-group' },
  { id: 'field-radio-group', label: 'Radio Group', icon: '◉', category: 'Selecao', fieldType: 'radio-group' },
  { id: 'field-tags', label: 'Tags', icon: '🏷', category: 'Selecao', fieldType: 'tags' },
  { id: 'field-color', label: 'Cor', icon: '🎨', category: 'Selecao', fieldType: 'color' },

  // Relacoes
  { id: 'field-relation', label: 'Relacao', icon: '🔗', category: 'Relacoes', fieldType: 'relation' },
  { id: 'field-sub-entity', label: 'Sub-entidade', icon: '📂', category: 'Relacoes', fieldType: 'sub-entity' },
  { id: 'field-lookup', label: 'Lookup', icon: '🔍', category: 'Relacoes', fieldType: 'lookup' },
  { id: 'field-api-select', label: 'API Select', icon: '⚡', category: 'Relacoes', fieldType: 'api-select' },
  { id: 'field-user-select', label: 'Usuario', icon: '👤', category: 'Relacoes', fieldType: 'user-select' },

  // Arquivos
  { id: 'field-file', label: 'Arquivo', icon: '📎', category: 'Arquivos', fieldType: 'file' },
  { id: 'field-image', label: 'Imagem', icon: '🖼', category: 'Arquivos', fieldType: 'image' },
  { id: 'field-signature', label: 'Assinatura', icon: '✍', category: 'Arquivos', fieldType: 'signature' },

  // Workflow
  { id: 'field-workflow-status', label: 'Status Workflow', icon: '🔄', category: 'Workflow', fieldType: 'workflow-status' },
  { id: 'field-timer', label: 'Timer', icon: '⏱', category: 'Workflow', fieldType: 'timer' },
  { id: 'field-sla-status', label: 'SLA', icon: '📊', category: 'Workflow', fieldType: 'sla-status' },
  { id: 'field-action-button', label: 'Botao de Acao', icon: '▶', category: 'Workflow', fieldType: 'action-button' },

  // Computados
  { id: 'field-formula', label: 'Formula', icon: '⚙', category: 'Computados', fieldType: 'formula' },
  { id: 'field-rollup', label: 'Rollup', icon: '∑', category: 'Computados', fieldType: 'rollup' },

  // Layout
  { id: 'field-section-title', label: 'Titulo de Secao', icon: '📌', category: 'Layout', fieldType: 'section-title' },
  { id: 'field-map', label: 'Mapa', icon: '🗺', category: 'Layout', fieldType: 'map' },
  { id: 'field-zone-diagram', label: 'Diagrama Zonas', icon: '📐', category: 'Layout', fieldType: 'zone-diagram' },

  // Outros
  { id: 'field-json', label: 'JSON', icon: '{}', category: 'Outros', fieldType: 'json' },
  { id: 'field-hidden', label: 'Oculto', icon: '👁', category: 'Outros', fieldType: 'hidden' },
];

/**
 * Registra todos os blocos no GrapeJS.
 * Cada bloco cria apenas o crm-field — o grid-row/grid-cell e criado
 * automaticamente pelo handler em grapejs-editor.tsx.
 *
 * Ao arrastar para o canvas/wrapper: cria nova row com 1 celula (12 colunas).
 * Ao arrastar para uma row existente: adiciona celula e redistribui colSpan.
 */
export function registerAllBlocks(editor: Editor) {
  for (const block of BLOCKS) {
    editor.BlockManager.add(block.id, {
      label: `<div style="display:flex;align-items:center;gap:6px;font-size:13px;">
        <span style="font-size:16px;width:24px;text-align:center;">${block.icon}</span>
        <span>${block.label}</span>
      </div>`,
      category: block.category,
      content: {
        type: `crm-field-${block.fieldType}`,
        fieldType: block.fieldType,
        fieldLabel: block.label,
        fieldName: generateSlug(block.label),
      },
      // Atributos visuais do bloco na paleta
      attributes: { class: 'gjs-block-field' },
    });
  }
}

/**
 * Gera um slug a partir do label.
 * Ex: "Texto rico" -> "texto_rico"
 */
function generateSlug(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
