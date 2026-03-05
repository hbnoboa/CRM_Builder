import type { Editor } from 'grapesjs';

/**
 * Categorias de blocos — cada bloco cria um crm-field com o tipo correspondente.
 * O bloco mostra um mini preview do campo real na paleta.
 */
export interface BlockDef {
  id: string;
  label: string;
  icon: string;
  category: string;
  fieldType: string;
}

export const BLOCKS: BlockDef[] = [
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
 * Cada bloco mostra um mini preview do campo na paleta (media)
 * e cria o crm-field ao ser arrastado para o canvas.
 */
export function registerAllBlocks(editor: Editor) {
  for (const block of BLOCKS) {
    editor.BlockManager.add(block.id, {
      label: block.label,
      media: getBlockMedia(block),
      category: block.category,
      content: {
        type: `crm-field-${block.fieldType}`,
        fieldType: block.fieldType,
        fieldLabel: block.label,
        fieldName: generateSlug(block.label),
      },
      attributes: { class: 'gjs-block-field' },
    });
  }
}

/**
 * Gera um slug a partir do label.
 */
function generateSlug(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Gera o HTML do mini preview para cada tipo de campo na paleta de blocos.
 * Replica visualmente o campo real em escala compacta.
 */
function getBlockMedia(block: BlockDef): string {
  const type = block.fieldType;
  const label = block.label;

  // Mini input preview (para text, email, number, etc.)
  const miniInput = (placeholder: string) => `
    <div class="blk-preview">
      <div class="blk-label">${label}</div>
      <div class="blk-input">${placeholder}</div>
    </div>`;

  // Mini textarea preview
  const miniTextarea = (placeholder: string) => `
    <div class="blk-preview">
      <div class="blk-label">${label}</div>
      <div class="blk-textarea">${placeholder}</div>
    </div>`;

  // Mini select preview
  const miniSelect = (placeholder: string) => `
    <div class="blk-preview">
      <div class="blk-label">${label}</div>
      <div class="blk-select"><span>${placeholder}</span><span class="blk-arrow">▾</span></div>
    </div>`;

  switch (type) {
    case 'text': return miniInput('Digite o texto...');
    case 'email': return miniInput('email@exemplo.com');
    case 'url': return miniInput('https://');
    case 'phone': return miniInput('(00) 00000-0000');
    case 'cpf': return miniInput('000.000.000-00');
    case 'cnpj': return miniInput('00.000.000/0000-00');
    case 'cep': return miniInput('00000-000');
    case 'password': return miniInput('••••••••');
    case 'number': return miniInput('0');
    case 'currency': return miniInput('R$ 0,00');
    case 'percentage': return miniInput('0,00 %');
    case 'date': return miniInput('dd/mm/aaaa');
    case 'datetime': return miniInput('dd/mm/aaaa hh:mm');
    case 'time': return miniInput('hh:mm');

    case 'textarea':
    case 'richtext':
      return miniTextarea('Digite...');

    case 'array':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div class="blk-input">Adicionar item...</div>
        <div class="blk-tags"><span class="blk-tag">Item 1</span><span class="blk-tag">Item 2</span></div>
      </div>`;

    case 'select':
    case 'api-select':
    case 'relation':
    case 'user-select':
    case 'lookup':
    case 'multiselect':
      return miniSelect('Selecionar...');

    case 'boolean':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <div class="blk-switch"><div class="blk-switch-thumb"></div></div>
          <span style="font-size:11px;opacity:0.6;">Nao</span>
        </div>
      </div>`;

    case 'checkbox-group':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div style="display:flex;flex-direction:column;gap:3px;">
          <div style="display:flex;align-items:center;gap:4px;"><div class="blk-checkbox"></div><span style="font-size:11px;">Opcao 1</span></div>
          <div style="display:flex;align-items:center;gap:4px;"><div class="blk-checkbox"></div><span style="font-size:11px;">Opcao 2</span></div>
        </div>
      </div>`;

    case 'radio-group':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div style="display:flex;flex-direction:column;gap:3px;">
          <div style="display:flex;align-items:center;gap:4px;"><div class="blk-radio"></div><span style="font-size:11px;">Opcao 1</span></div>
          <div style="display:flex;align-items:center;gap:4px;"><div class="blk-radio"></div><span style="font-size:11px;">Opcao 2</span></div>
        </div>
      </div>`;

    case 'tags':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div class="blk-tags"><span class="blk-tag">tag1</span><span class="blk-tag">tag2</span><span class="blk-tag">tag3</span></div>
      </div>`;

    case 'color':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:20px;height:20px;border-radius:4px;background:#3b82f6;border:1px solid hsl(var(--border));"></div>
          <div class="blk-input" style="flex:1;">#3b82f6</div>
        </div>
      </div>`;

    case 'slider':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div style="position:relative;height:6px;border-radius:3px;background:hsl(var(--muted));margin:6px 0;">
          <div style="width:50%;height:100%;border-radius:3px;background:hsl(var(--primary));"></div>
          <div style="width:12px;height:12px;border-radius:50%;background:hsl(var(--primary));position:absolute;top:-3px;left:calc(50% - 6px);"></div>
        </div>
      </div>`;

    case 'rating':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div style="display:flex;gap:2px;font-size:14px;color:#f59e0b;">★★★<span style="opacity:0.3;">★★</span></div>
      </div>`;

    case 'file':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div class="blk-dropzone">📎 Arraste arquivos</div>
      </div>`;

    case 'image':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div class="blk-dropzone">📷 Arraste imagens</div>
      </div>`;

    case 'signature':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div class="blk-dropzone">✍ Assinar aqui</div>
      </div>`;

    case 'section-title':
      return `<div class="blk-preview">
        <div style="padding:4px 0;border-bottom:1px solid hsl(var(--border));font-size:12px;font-weight:600;">Titulo da Secao</div>
      </div>`;

    case 'workflow-status':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div class="blk-select" style="border-left:3px solid #3b82f6;"><span>Status</span><span class="blk-arrow">▾</span></div>
      </div>`;

    case 'timer':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div style="font-family:monospace;font-size:12px;">⏱ 00:00:00</div>
      </div>`;

    case 'sla-status':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div style="display:flex;align-items:center;gap:4px;font-size:11px;">
          <span style="width:8px;height:8px;border-radius:50%;background:#22c55e;"></span>Dentro do SLA
        </div>
      </div>`;

    case 'action-button':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div style="background:hsl(var(--primary));color:hsl(var(--primary-foreground));font-size:11px;padding:4px 10px;border-radius:4px;text-align:center;">Acao</div>
      </div>`;

    case 'formula':
    case 'rollup':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div class="blk-input" style="opacity:0.6;">⚡ Calculado</div>
      </div>`;

    case 'map':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div class="blk-dropzone">🗺 Mapa</div>
      </div>`;

    case 'zone-diagram':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div class="blk-dropzone">📐 Diagrama</div>
      </div>`;

    case 'json':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div class="blk-input" style="font-family:monospace;font-size:10px;">{ }</div>
      </div>`;

    case 'hidden':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div style="font-size:11px;opacity:0.5;font-style:italic;">👁 Campo oculto</div>
      </div>`;

    case 'sub-entity':
      return `<div class="blk-preview">
        <div class="blk-label">${label}</div>
        <div class="blk-dropzone">📂 Sub-entidade</div>
      </div>`;

    default:
      return miniInput('...');
  }
}
