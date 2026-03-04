/**
 * Renderiza o HTML WYSIWYG de cada tipo de campo para o canvas do GrapeJS.
 * Os campos sao renderizados desabilitados (apenas visualizacao).
 */

interface RenderOptions {
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  label?: string;
  actionLabel?: string;
}

export function renderFieldByType(type: string, opts: RenderOptions = {}): string {
  const { placeholder = '', options = [] } = opts;

  switch (type) {
    // === Texto ===
    case 'text':
    case 'email':
    case 'url':
    case 'cpf':
    case 'cnpj':
    case 'cep':
    case 'phone':
      return `<input type="text" class="crm-input" placeholder="${esc(placeholder || getDefaultPlaceholder(type))}" disabled />`;

    case 'password':
      return `<input type="password" class="crm-input" placeholder="••••••••" disabled />`;

    case 'textarea':
      return `<textarea class="crm-textarea" placeholder="${esc(placeholder)}" disabled></textarea>`;

    case 'richtext':
      return `<div class="crm-textarea" style="min-height: 100px; cursor: text;">
        <span style="color: var(--muted-fg, #a1a1aa);">${placeholder || 'Editor de texto rico...'}</span>
      </div>`;

    case 'array':
      return `<div>
        <input type="text" class="crm-input" placeholder="${esc(placeholder || 'Adicionar item...')}" disabled />
        <div style="display: flex; gap: 4px; margin-top: 6px;">
          <span class="crm-tag">Item 1</span>
          <span class="crm-tag">Item 2</span>
        </div>
      </div>`;

    // === Numeros ===
    case 'number':
      return `<input type="text" class="crm-input" placeholder="${esc(placeholder || '0')}" disabled />`;

    case 'currency':
      return `<div class="crm-input-with-icon">
        <input type="text" class="crm-input" style="padding-left: 36px;" placeholder="${esc(placeholder || '0,00')}" disabled />
        <span class="crm-input-icon" style="left: 12px; right: auto;">R$</span>
      </div>`;

    case 'percentage':
      return `<div class="crm-input-with-icon">
        <input type="text" class="crm-input" placeholder="${esc(placeholder || '0,00')}" disabled />
        <span class="crm-input-icon">%</span>
      </div>`;

    case 'slider':
      return `<div style="padding: 4px 0;">
        <div class="crm-slider-track">
          <div class="crm-slider-fill"></div>
          <div class="crm-slider-thumb"></div>
        </div>
      </div>`;

    case 'rating':
      return `<div class="crm-rating">
        ${'<span class="crm-rating-star">&#9733;</span>'.repeat(5)}
      </div>`;

    // === Datas ===
    case 'date':
      return `<div class="crm-input-with-icon">
        <input type="text" class="crm-input" placeholder="${esc(placeholder || 'dd/mm/aaaa')}" disabled />
        <span class="crm-input-icon">&#128197;</span>
      </div>`;

    case 'datetime':
      return `<div class="crm-input-with-icon">
        <input type="text" class="crm-input" placeholder="${esc(placeholder || 'dd/mm/aaaa hh:mm')}" disabled />
        <span class="crm-input-icon">&#128197;</span>
      </div>`;

    case 'time':
      return `<div class="crm-input-with-icon">
        <input type="text" class="crm-input" placeholder="${esc(placeholder || 'hh:mm')}" disabled />
        <span class="crm-input-icon">&#9201;</span>
      </div>`;

    // === Selecao ===
    case 'boolean':
      return `<div class="crm-switch">
        <div class="crm-switch-track"><div class="crm-switch-thumb"></div></div>
        <span class="crm-switch-label">Nao</span>
      </div>`;

    case 'select':
    case 'api-select':
    case 'relation':
    case 'user-select':
    case 'lookup':
      return `<div class="crm-select">
        <span>${esc(placeholder || getDefaultPlaceholder(type))}</span>
        <span class="crm-select-arrow">&#9660;</span>
      </div>`;

    case 'multiselect':
      return `<div>
        <div class="crm-select">
          <span>${esc(placeholder || 'Selecionar...')}</span>
          <span class="crm-select-arrow">&#9660;</span>
        </div>
        ${options.length > 0 ? `<div style="display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap;">
          ${options.slice(0, 3).map(o => `<span class="crm-tag">${esc(o.label)}</span>`).join('')}
        </div>` : ''}
      </div>`;

    case 'checkbox-group':
      return `<div class="crm-checkbox-group">
        ${(options.length > 0 ? options.slice(0, 4) : [{ label: 'Opcao 1' }, { label: 'Opcao 2' }, { label: 'Opcao 3' }])
          .map(o => `<div class="crm-checkbox-item"><div class="crm-checkbox-box"></div>${esc(o.label)}</div>`)
          .join('')}
      </div>`;

    case 'radio-group':
      return `<div class="crm-radio-group">
        ${(options.length > 0 ? options.slice(0, 4) : [{ label: 'Opcao 1' }, { label: 'Opcao 2' }, { label: 'Opcao 3' }])
          .map(o => `<div class="crm-radio-item"><div class="crm-radio-circle"></div>${esc(o.label)}</div>`)
          .join('')}
      </div>`;

    case 'tags':
      return `<div>
        <input type="text" class="crm-input" placeholder="${esc(placeholder || 'Adicionar tag...')}" disabled />
        <div style="display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap;">
          ${options.slice(0, 3).map(o => `<span class="crm-tag">${esc(o.label)}</span>`).join('') || '<span class="crm-tag">tag1</span><span class="crm-tag">tag2</span>'}
        </div>
      </div>`;

    case 'color':
      return `<div class="crm-color-preview">
        <div class="crm-color-swatch"></div>
        <input type="text" class="crm-input" style="flex: 1;" placeholder="#000000" disabled />
      </div>`;

    // === Workflow ===
    case 'workflow-status':
      return `<div class="crm-select" style="border-left: 3px solid #3b82f6;">
        <span>${esc(opts.label || 'Status inicial')}</span>
        <span class="crm-select-arrow">&#9660;</span>
      </div>`;

    case 'timer':
      return `<div class="crm-timer">
        <span>&#9201;</span> 00:00:00
      </div>`;

    case 'sla-status':
      return `<div style="display: flex; align-items: center; gap: 8px;">
        <span style="width: 10px; height: 10px; border-radius: 50%; background: #22c55e;"></span>
        <span style="font-size: 14px;">Dentro do SLA</span>
      </div>`;

    case 'action-button':
      return `<button class="crm-action-button" disabled>
        ${esc(opts.actionLabel || 'Acao')}
      </button>`;

    // === Arquivos ===
    case 'file':
      return `<div class="crm-dropzone">
        <div class="crm-dropzone-icon">&#128206;</div>
        <span>Clique ou arraste arquivos</span>
      </div>`;

    case 'image':
      return `<div class="crm-dropzone">
        <div class="crm-dropzone-icon">&#128247;</div>
        <span>Clique ou arraste imagens</span>
      </div>`;

    case 'signature':
      return `<div class="crm-signature-placeholder">
        <span>Assinar aqui</span>
      </div>`;

    // === Especiais ===
    case 'map':
      return `<div class="crm-map-placeholder">
        <span>&#128506; Mapa</span>
      </div>`;

    case 'hidden':
      return `<div class="crm-hidden-indicator">
        <span>&#128065;</span> Campo oculto
      </div>`;

    case 'json':
      return `<div class="crm-json-preview">{ }</div>`;

    case 'sub-entity':
      return `<div style="border: 1px solid var(--border, #e4e4e7); border-radius: 8px; padding: 16px; text-align: center; color: var(--muted-fg, #a1a1aa);">
        <div style="font-size: 20px; margin-bottom: 4px;">&#128194;</div>
        <span>Sub-entidade</span>
      </div>`;

    case 'zone-diagram':
      return `<div style="border: 1px solid var(--border, #e4e4e7); border-radius: 8px; padding: 16px; text-align: center; color: var(--muted-fg, #a1a1aa); min-height: 100px;">
        <div style="font-size: 20px; margin-bottom: 4px;">&#128506;</div>
        <span>Diagrama de zonas</span>
      </div>`;

    case 'section-title':
      return ''; // Handled separately in base-field.ts

    case 'formula':
    case 'rollup':
      return `<div class="crm-input" style="background: var(--muted, #f4f4f5); cursor: default; color: var(--muted-fg, #a1a1aa);">
        <span>&#9889; Calculado automaticamente</span>
      </div>`;

    default:
      return `<input type="text" class="crm-input" placeholder="${esc(placeholder)}" disabled />`;
  }
}

function getDefaultPlaceholder(type: string): string {
  const placeholders: Record<string, string> = {
    text: 'Digite o texto...',
    email: 'email@exemplo.com',
    url: 'https://',
    cpf: '000.000.000-00',
    cnpj: '00.000.000/0000-00',
    cep: '00000-000',
    phone: '(00) 00000-0000',
    select: 'Selecionar...',
    'api-select': 'Buscar...',
    relation: 'Selecionar registro...',
    'user-select': 'Selecionar usuario...',
    lookup: 'Buscar...',
  };
  return placeholders[type] || '';
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
