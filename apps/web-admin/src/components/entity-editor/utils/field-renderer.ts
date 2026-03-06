/**
 * Renderiza o HTML WYSIWYG de cada tipo de campo para o canvas do GrapeJS.
 * Os campos sao renderizados desabilitados (apenas visualizacao).
 */

interface RenderOptions {
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  label?: string;
  actionLabel?: string;
  diagramImage?: string;
  diagramZones?: Array<{ id: string; label: string | number; x: number; y: number }>;
  // Entity reference info (relation, api-select, sub-entity)
  entitySlug?: string;
  displayField?: string;
  apiEndpoint?: string;
  subEntitySlug?: string;
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
      return `<div class="crm-select">
        <span>${esc(placeholder || getDefaultPlaceholder(type))}</span>
        <span class="crm-select-arrow">&#9660;</span>
      </div>`;

    case 'relation': {
      const relInfo = opts.entitySlug
        ? `<div class="crm-field-ref">&#128279; ${esc(opts.entitySlug)}${opts.displayField ? ` &rarr; ${esc(opts.displayField)}` : ''}</div>`
        : '';
      return `<div class="crm-select">
        <span>${esc(placeholder || getDefaultPlaceholder(type))}</span>
        <span class="crm-select-arrow">&#9660;</span>
      </div>${relInfo}`;
    }

    case 'api-select': {
      const apiInfo = opts.apiEndpoint
        ? `<div class="crm-field-ref">&#9889; ${esc(opts.apiEndpoint)}</div>`
        : '';
      return `<div class="crm-select">
        <span>${esc(placeholder || getDefaultPlaceholder(type))}</span>
        <span class="crm-select-arrow">&#9660;</span>
      </div>${apiInfo}`;
    }

    case 'user-select':
    case 'lookup':
      return `<div class="crm-select">
        <span>${esc(placeholder || getDefaultPlaceholder(type))}</span>
        <span class="crm-select-arrow">&#9660;</span>
      </div>`;

    case 'sub-entity': {
      const subInfo = opts.subEntitySlug
        ? `<span style="font-size: 11px; color: var(--muted-fg, #a1a1aa);">&#128279; ${esc(opts.subEntitySlug)}</span>`
        : '';
      return `<div style="border: 1px solid var(--border, #e4e4e7); border-radius: 8px; padding: 16px; text-align: center; color: var(--muted-fg, #a1a1aa);">
        <div style="font-size: 20px; margin-bottom: 4px;">&#128194;</div>
        <span>Sub-entidade</span>
        ${subInfo}
      </div>`;
    }

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
        <span class="crm-dropzone-icon">&#128206;</span>
        <span>Clique ou arraste arquivos</span>
      </div>`;

    case 'image':
      return `<div class="crm-dropzone">
        <span class="crm-dropzone-icon">&#128247;</span>
        <span>Clique ou arraste imagens</span>
      </div>`;

    case 'signature':
      return `<div class="crm-signature-placeholder">
        <span>Assinar aqui</span>
      </div>`;

    // === Especiais ===
    case 'map':
      return `<div class="crm-map-container">
        <div class="crm-map-inputs">
          <div class="crm-map-search">
            <span class="crm-map-search-icon">&#128269;</span>
            <input type="text" class="crm-input crm-map-search-input" placeholder="Buscar endereco..." disabled />
          </div>
          <div class="crm-map-coords">
            <div class="crm-map-coord-field">
              <label class="crm-map-coord-label">Lat</label>
              <input type="text" class="crm-input" placeholder="-23.5505" disabled />
            </div>
            <div class="crm-map-coord-field">
              <label class="crm-map-coord-label">Lng</label>
              <input type="text" class="crm-input" placeholder="-46.6333" disabled />
            </div>
          </div>
        </div>
        <div class="crm-map-tile">
          <div class="crm-map-grid"></div>
          <div class="crm-map-marker">
            <div class="crm-map-marker-pin"></div>
            <div class="crm-map-marker-shadow"></div>
          </div>
        </div>
      </div>`;

    case 'hidden':
      return `<div class="crm-hidden-indicator">
        <span>&#128065;</span> Campo oculto
      </div>`;

    case 'json':
      return `<div class="crm-json-preview">{ }</div>`;

    case 'zone-diagram': {
      const zones = opts.diagramZones || [];
      const imgUrl = opts.diagramImage || '';

      const zonesHtml = zones.length > 0
        ? zones.map((z) =>
            `<div class="crm-zone-point" style="left: ${z.x}%; top: ${z.y}%;">
              <span>${esc(String(z.label))}</span>
            </div>`
          ).join('')
        : '';

      const imageContent = imgUrl
        ? `<img src="${esc(imgUrl)}" alt="Diagrama" class="crm-zone-img" />`
        : `<div class="crm-zone-bg-pattern"></div>`;

      const emptyMsg = !imgUrl && zones.length === 0
        ? `<div class="crm-zone-empty">Nenhuma imagem ou zona configurada</div>`
        : '';

      return `<div class="crm-zone-diagram">
        <div class="crm-zone-header">
          <span class="crm-zone-header-icon">&#128205;</span>
          <span>Diagrama de Zonas</span>
        </div>
        <div class="crm-zone-image-area">
          ${imageContent}
          ${zonesHtml}
          ${emptyMsg}
        </div>
      </div>`;
    }

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
