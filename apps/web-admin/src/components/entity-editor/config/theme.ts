/**
 * CSS injetado no iframe do canvas do GrapeJS.
 * Replica EXATAMENTE os estilos do formulario real (record-form-dialog.tsx)
 * usando os valores HSL de globals.css convertidos para hex.
 */
export function getCanvasCss(isDark: boolean): string {
  // Cores exatas de globals.css (paleta slate)
  const bg = isDark ? '#020817' : '#ffffff';
  const fg = isDark ? '#f8fafc' : '#020817';
  const muted = isDark ? '#1e293b' : '#f1f5f9';
  const mutedFg = isDark ? '#94a3b8' : '#64748b';
  const border = isDark ? '#1e293b' : '#e2e8f0';
  const input = isDark ? '#1e293b' : '#e2e8f0';
  const ring = isDark ? '#cbd5e1' : '#020817';
  const destructive = '#ef4444';
  const primary = isDark ? '#f8fafc' : '#0f172a';
  const primaryFg = isDark ? '#020817' : '#ffffff';
  const accent = isDark ? '#1e293b' : '#f1f5f9';

  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${muted} !important;
      color: ${fg};
      padding: 24px;
      font-size: 14px;
      line-height: 1.5;
    }

    /* ━━━ Layout System — Flexbox (necessario para GrapeJS sorter horizontal) ━━━ */
    /* GrapeJS so detecta layout horizontal com display:flex (nao grid).
       Sem isso, o sorter so mostra indicadores acima/abaixo, nunca esquerda/direita. */
    .grid-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 24px;
      min-height: 40px;
      padding: 4px 0;
    }

    .grid-cell {
      min-height: 40px;
      min-width: 0;
    }
    .grid-cell:empty {
      border: 2px dashed ${border};
      border-radius: 6px;
      min-height: 60px;
    }

    /* colSpan classes — flex-basis = N/12 * 100% - gap_adjustment
       Formula: calc(N/12 * 100% - 16px * (12-N)/12) */
    .col-span-1  { flex: 0 0 calc(8.333% - 14.667px); max-width: calc(8.333% - 14.667px); }
    .col-span-2  { flex: 0 0 calc(16.667% - 13.333px); max-width: calc(16.667% - 13.333px); }
    .col-span-3  { flex: 0 0 calc(25% - 12px); max-width: calc(25% - 12px); }
    .col-span-4  { flex: 0 0 calc(33.333% - 10.667px); max-width: calc(33.333% - 10.667px); }
    .col-span-5  { flex: 0 0 calc(41.667% - 9.333px); max-width: calc(41.667% - 9.333px); }
    .col-span-6  { flex: 0 0 calc(50% - 8px); max-width: calc(50% - 8px); }
    .col-span-7  { flex: 0 0 calc(58.333% - 6.667px); max-width: calc(58.333% - 6.667px); }
    .col-span-8  { flex: 0 0 calc(66.667% - 5.333px); max-width: calc(66.667% - 5.333px); }
    .col-span-9  { flex: 0 0 calc(75% - 4px); max-width: calc(75% - 4px); }
    .col-span-10 { flex: 0 0 calc(83.333% - 2.667px); max-width: calc(83.333% - 2.667px); }
    .col-span-11 { flex: 0 0 calc(91.667% - 1.333px); max-width: calc(91.667% - 1.333px); }
    .col-span-12 { flex: 0 0 100%; max-width: 100%; }

    /* rowSpan — convertido para altura fixa (80px base + gap) */
    .row-span-2 { height: calc(2 * 80px + 16px); }
    .row-span-3 { height: calc(3 * 80px + 2 * 16px); }
    .row-span-4 { height: calc(4 * 80px + 3 * 16px); }
    .row-span-5 { height: calc(5 * 80px + 4 * 16px); }
    .row-span-6 { height: calc(6 * 80px + 5 * 16px); }

    /* ━━━ Field Preview (replica space-y-2 do formulario real) ━━━ */
    .crm-field-preview {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* Label: replica text-sm font-medium leading-none do Label component */
    .crm-field-preview label {
      display: block !important;
      font-size: 0.875rem !important;
      font-weight: 500 !important;
      line-height: 1 !important;
      color: ${fg} !important;
      margin-bottom: 0 !important;
    }
    .crm-field-preview .required-mark {
      color: ${destructive} !important;
      margin-left: 4px;
    }
    .crm-field-preview .crm-help-text {
      font-size: 0.75rem;
      color: ${mutedFg};
      margin-top: -2px;
    }

    /* ━━━ Input (replica exata do shadcn Input) ━━━ */
    /* flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm */
    .crm-input {
      display: flex;
      align-items: center;
      height: 2.5rem;
      width: 100%;
      border-radius: 0.375rem;
      border: 1px solid ${input} !important;
      background: ${bg} !important;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      line-height: 1.25rem;
      color: ${fg} !important;
      outline: none;
      font-family: inherit;
    }
    .crm-input::placeholder { color: ${mutedFg} !important; }
    .crm-input:disabled { opacity: 1 !important; cursor: default; }

    /* ━━━ Textarea (replica exata do shadcn Textarea) ━━━ */
    /* flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm */
    .crm-textarea {
      display: flex;
      min-height: 80px;
      width: 100%;
      border-radius: 0.375rem;
      border: 1px solid ${input} !important;
      background: ${bg} !important;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      line-height: 1.25rem;
      color: ${fg} !important;
      resize: vertical;
      font-family: inherit;
    }
    .crm-textarea::placeholder { color: ${mutedFg} !important; }
    .crm-textarea:disabled { opacity: 1 !important; cursor: default; }

    /* ━━━ Select (replica do SearchableSelect trigger) ━━━ */
    /* flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm */
    .crm-select {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 2.5rem;
      width: 100%;
      border-radius: 0.375rem;
      border: 1px solid ${input} !important;
      background: ${bg} !important;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      color: ${mutedFg} !important;
      cursor: pointer;
    }
    .crm-select-arrow { font-size: 10px; color: ${mutedFg}; opacity: 0.5; }

    /* ━━━ Switch/Toggle (replica exata do shadcn Switch) ━━━ */
    /* peer inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent bg-input */
    .crm-switch {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .crm-switch-track {
      display: inline-flex;
      width: 2.75rem;
      height: 1.5rem;
      border-radius: 9999px;
      background: ${input};
      position: relative;
      flex-shrink: 0;
      border: 2px solid transparent;
      cursor: pointer;
    }
    .crm-switch-thumb {
      display: block;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 9999px;
      background: ${bg};
      position: absolute;
      top: 50%;
      left: 0;
      transform: translateY(-50%);
      box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
    }
    .crm-switch-label { font-size: 0.875rem; color: ${fg}; cursor: pointer; }

    /* ━━━ Dropzone ━━━ */
    .crm-dropzone {
      border: 2px dashed ${border};
      border-radius: 0.5rem;
      padding: 24px;
      text-align: center;
      color: ${mutedFg};
      font-size: 0.8125rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .crm-dropzone-icon { font-size: 24px; margin-bottom: 4px; }

    /* ━━━ Map ━━━ */
    .crm-map-placeholder {
      border: 1px solid ${border};
      border-radius: 0.5rem;
      background: ${muted};
      height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${mutedFg};
      font-size: 0.875rem;
    }

    /* ━━━ Rating ━━━ */
    .crm-rating { display: flex; gap: 4px; font-size: 20px; color: ${mutedFg}; }
    .crm-rating-star { opacity: 0.3; }
    .crm-rating-star.filled { opacity: 1; color: #f59e0b; }

    /* ━━━ Slider ━━━ */
    .crm-slider-track {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: ${muted};
      position: relative;
    }
    .crm-slider-fill { width: 50%; height: 100%; border-radius: 3px; background: ${primary}; }
    .crm-slider-thumb {
      width: 16px; height: 16px; border-radius: 50%; background: ${primary};
      position: absolute; top: -5px; left: calc(50% - 8px);
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    /* ━━━ Color ━━━ */
    .crm-color-preview { display: flex; align-items: center; gap: 8px; }
    .crm-color-swatch {
      width: 2.5rem; height: 2.5rem; border-radius: 0.375rem;
      border: 1px solid ${border}; background: #3b82f6;
      cursor: pointer;
    }

    /* ━━━ Section title (replica: pt-4 pb-1 border-b border-border) ━━━ */
    .crm-section-title {
      padding-top: 1rem;
      padding-bottom: 0.25rem;
      border-bottom: 1px solid ${border};
      font-size: 1rem;
      font-weight: 600;
      color: ${fg};
    }

    /* ━━━ Signature ━━━ */
    .crm-signature-placeholder {
      border: 1px solid ${border}; border-radius: 0.5rem; background: transparent;
      height: 120px; display: flex; align-items: center; justify-content: center;
      color: ${mutedFg}; font-size: 0.875rem;
    }

    /* ━━━ Input with icon (currency R$, percentage %) ━━━ */
    .crm-input-with-icon { position: relative; }
    .crm-input-with-icon .crm-input { padding-right: 36px; }
    .crm-input-icon {
      position: absolute; right: 0.75rem; top: 50%;
      transform: translateY(-50%); color: ${mutedFg}; font-size: 0.875rem;
      pointer-events: none;
    }

    /* ━━━ Tags / Badges ━━━ */
    .crm-tag {
      display: inline-flex; align-items: center; padding: 2px 8px;
      border-radius: 9999px; font-size: 0.75rem; font-weight: 500;
      background: ${accent}; color: ${fg}; border: 1px solid ${border};
    }

    /* ━━━ Hidden field ━━━ */
    .crm-hidden-indicator {
      display: flex; align-items: center; gap: 6px;
      padding: 0.5rem 0.75rem; background: ${muted}; border-radius: 0.375rem;
      color: ${mutedFg}; font-size: 0.8125rem; font-style: italic;
    }

    /* ━━━ JSON ━━━ */
    .crm-json-preview {
      font-family: 'Fira Code', 'Consolas', monospace; font-size: 0.75rem;
      padding: 0.5rem 0.75rem; background: ${muted}; border-radius: 0.375rem;
      color: ${mutedFg}; border: 1px solid ${border}; min-height: 60px;
    }

    /* ━━━ Checkbox group (replica: h-4 w-4 rounded-sm border border-primary) ━━━ */
    .crm-checkbox-group { display: flex; flex-wrap: wrap; gap: 12px; }
    .crm-checkbox-item { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; color: ${fg}; }
    .crm-checkbox-box {
      width: 1rem; height: 1rem; border: 1px solid ${primary};
      border-radius: 0.125rem; background: transparent; flex-shrink: 0;
    }

    /* ━━━ Radio group ━━━ */
    .crm-radio-group { display: flex; flex-direction: column; gap: 10px; }
    .crm-radio-item { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; color: ${fg}; }
    .crm-radio-circle {
      width: 1rem; height: 1rem; border: 1px solid ${primary};
      border-radius: 50%; background: transparent; flex-shrink: 0;
    }

    /* ━━━ Action button (replica do shadcn Button default) ━━━ */
    .crm-action-button {
      display: inline-flex; align-items: center; justify-content: center;
      height: 2.5rem; padding: 0 1rem; border-radius: 0.375rem;
      background: ${primary}; color: ${primaryFg};
      font-size: 0.875rem; font-weight: 500; border: none;
      font-family: inherit;
    }

    /* ━━━ Timer ━━━ */
    .crm-timer {
      display: flex; align-items: center; gap: 8px;
      font-family: 'Fira Code', monospace; font-size: 1rem; color: ${fg};
    }

    /* ━━━ Pointer events: desabilitar em form elements para permitir selecao ━━━ */
    .crm-input,
    .crm-textarea,
    .crm-select,
    .crm-action-button,
    .crm-switch-track,
    .crm-switch-thumb,
    .crm-color-swatch,
    .crm-checkbox-box,
    .crm-radio-circle,
    .crm-slider-track,
    .crm-slider-thumb,
    .crm-slider-fill,
    .crm-dropzone,
    .crm-signature-placeholder,
    .crm-map-placeholder,
    .crm-json-preview,
    .crm-hidden-indicator {
      pointer-events: none !important;
    }

    /* ━━━ GrapeJS selection overlay ━━━ */
    .gjs-selected { outline: 2px solid #3b82f6 !important; outline-offset: 2px; border-radius: 6px; }
    .gjs-hovered { outline: 1px dashed ${ring} !important; border-radius: 6px; }

    /* ━━━ Drag-drop visual indicators ━━━ */
    /* Placeholder mostrado pelo sorter durante o drag */
    .gjs-placeholder {
      border: 2px dashed #3b82f6 !important;
      background: rgba(59, 130, 246, 0.05) !important;
      border-radius: 6px !important;
      min-height: 50px !important;
    }

    /* Grid row drop target highlighting */
    .grid-row.gjs-comp-highlighted {
      outline: 2px dashed #3b82f6 !important;
      outline-offset: -2px;
      border-radius: 6px;
      background: rgba(59, 130, 246, 0.03);
    }

    /* Grid cell drop target highlighting */
    .grid-cell.gjs-comp-highlighted {
      outline: 2px dashed #3b82f6 !important;
      outline-offset: -2px;
      border-radius: 6px;
      background: rgba(59, 130, 246, 0.05);
    }

    /* Wrapper (canvas body) — add bottom padding for easier drop */
    [data-gjs-type="wrapper"] {
      min-height: calc(100vh - 32px);
      padding-bottom: 80px !important;
    }

    /* ━━━ Resize indicator badge ━━━ */
    .crm-resize-indicator {
      position: absolute;
      bottom: 4px;
      right: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      background: #3b82f6;
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      font-family: 'Inter', monospace;
      white-space: nowrap;
      pointer-events: none;
      z-index: 100;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
  `;
}

/**
 * CSS para o editor GrapeJS (fora do iframe, UI do editor)
 */
export const editorStyles = `
  .gjs-one-bg { background-color: hsl(var(--background)); }
  .gjs-two-color { color: hsl(var(--foreground)); }
  .gjs-three-bg { background-color: hsl(var(--muted)); }
  .gjs-four-color, .gjs-four-color-h:hover { color: hsl(var(--primary)); }

  /* Canvas wrapper: fundo cinza igual ao das paginas do dashboard */
  .gjs-cv-canvas { background: hsl(var(--muted)) !important; }
  .gjs-cv-canvas-bg { background-color: hsl(var(--muted)) !important; }
  .gjs-frame-wrapper { background: hsl(var(--muted)) !important; }
  .gjs-frame-wrapper__top { background: transparent !important; }

  /* ━━━ Block categories (accordions na paleta esquerda) ━━━ */
  .gjs-block-categories {
    padding: 0 !important;
  }
  .gjs-block-category {
    border-bottom: 1px solid hsl(var(--border)) !important;
  }
  .gjs-block-category .gjs-title {
    background: hsl(var(--muted)) !important;
    border: none !important;
    padding: 8px 12px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.05em !important;
    color: hsl(var(--muted-foreground)) !important;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
  }
  .gjs-block-category .gjs-title:hover {
    background: hsl(var(--accent)) !important;
    color: hsl(var(--foreground)) !important;
  }
  .gjs-block-category .gjs-caret-icon {
    font-size: 10px;
    margin-right: 6px;
    color: hsl(var(--muted-foreground));
    transition: transform 0.2s;
  }
  .gjs-block-category.gjs-open .gjs-caret-icon {
    transform: rotate(90deg);
  }
  .gjs-block-category .gjs-blocks-c {
    padding: 4px !important;
  }

  /* ━━━ Block previews na paleta ━━━ */
  .gjs-block {
    padding: 6px 8px !important;
    min-height: auto !important;
    border: 1px solid transparent !important;
    border-radius: 6px !important;
    margin: 2px !important;
    transition: border-color 0.15s, background 0.15s;
  }
  .gjs-block:hover {
    border-color: hsl(var(--border)) !important;
    background: hsl(var(--accent)) !important;
  }
  .gjs-block-field { width: 100% !important; }
  .gjs-block-label { width: 100%; }

  .blk-preview { display: flex; flex-direction: column; gap: 4px; width: 100%; text-align: left; }
  .blk-label { font-size: 11px; font-weight: 500; color: hsl(var(--foreground)); opacity: 0.9; }
  .blk-input {
    height: 24px; border-radius: 4px; padding: 0 8px; font-size: 10px;
    border: 1px solid hsl(var(--border)); background: hsl(var(--background));
    color: hsl(var(--muted-foreground)); display: flex; align-items: center;
  }
  .blk-textarea {
    height: 32px; border-radius: 4px; padding: 4px 8px; font-size: 10px;
    border: 1px solid hsl(var(--border)); background: hsl(var(--background));
    color: hsl(var(--muted-foreground));
  }
  .blk-select {
    height: 24px; border-radius: 4px; padding: 0 8px; font-size: 10px;
    border: 1px solid hsl(var(--border)); background: hsl(var(--background));
    color: hsl(var(--muted-foreground)); display: flex; align-items: center;
    justify-content: space-between;
  }
  .blk-arrow { font-size: 8px; opacity: 0.5; }
  .blk-tags { display: flex; gap: 3px; flex-wrap: wrap; }
  .blk-tag {
    font-size: 9px; padding: 1px 6px; border-radius: 9999px;
    background: hsl(var(--accent)); color: hsl(var(--foreground));
    border: 1px solid hsl(var(--border));
  }
  .blk-switch {
    width: 28px; height: 14px; border-radius: 7px; background: hsl(var(--input));
    position: relative;
  }
  .blk-switch-thumb {
    width: 10px; height: 10px; border-radius: 50%; background: hsl(var(--background));
    position: absolute; top: 2px; left: 2px;
  }
  .blk-checkbox {
    width: 10px; height: 10px; border: 1px solid hsl(var(--primary));
    border-radius: 2px;
  }
  .blk-radio {
    width: 10px; height: 10px; border: 1px solid hsl(var(--primary));
    border-radius: 50%;
  }
  .blk-dropzone {
    border: 1px dashed hsl(var(--border)); border-radius: 4px; padding: 6px;
    text-align: center; font-size: 10px; color: hsl(var(--muted-foreground));
  }

  /* ━━━ Traits Panel — estilo do painel de propriedades ━━━ */

  /* Container de traits */
  .traits-container .gjs-traits { padding: 0 !important; }

  /* Trait category (collapsible section) */
  .gjs-trt-category {
    border-bottom: 1px solid hsl(var(--border));
  }
  .gjs-trt-category__title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    color: hsl(var(--foreground));
    background: hsl(var(--muted));
    user-select: none;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .gjs-trt-category__title:hover {
    background: hsl(var(--accent));
  }
  .gjs-trt-category__title .gjs-caret-icon {
    transition: transform 0.2s;
    font-size: 10px;
    color: hsl(var(--muted-foreground));
  }
  .gjs-trt-category.gjs-trt-category--open .gjs-caret-icon {
    transform: rotate(90deg);
  }

  /* Trait items dentro de categorias */
  .gjs-trt-trait {
    padding: 6px 12px !important;
    border-bottom: 1px solid hsl(var(--border) / 0.3);
  }
  .gjs-trt-trait:last-child { border-bottom: none; }

  /* Trait labels */
  .gjs-trt-trait .gjs-label-wrp {
    min-width: 80px !important;
    font-size: 12px !important;
    color: hsl(var(--muted-foreground)) !important;
    font-weight: 400 !important;
  }

  /* Trait inputs */
  .gjs-trt-trait .gjs-field {
    background: hsl(var(--background)) !important;
    border: 1px solid hsl(var(--border)) !important;
    border-radius: 6px !important;
    color: hsl(var(--foreground)) !important;
    font-size: 13px !important;
  }
  .gjs-trt-trait .gjs-field:focus-within {
    border-color: hsl(var(--ring)) !important;
    box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2) !important;
  }
  .gjs-trt-trait input,
  .gjs-trt-trait select,
  .gjs-trt-trait textarea {
    color: hsl(var(--foreground)) !important;
    background: transparent !important;
    font-size: 13px !important;
    padding: 4px 8px !important;
  }
  .gjs-trt-trait input::placeholder {
    color: hsl(var(--muted-foreground)) !important;
  }

  /* Checkbox trait */
  .gjs-trt-trait .gjs-chk-icon {
    border-color: hsl(var(--border)) !important;
    background: hsl(var(--background)) !important;
    border-radius: 4px !important;
  }
  .gjs-trt-trait .gjs-chk-icon.gjs-chk-checked {
    background: hsl(var(--primary)) !important;
    border-color: hsl(var(--primary)) !important;
  }

  /* Select trait dropdown */
  .gjs-trt-trait select {
    border: none !important;
    outline: none !important;
    cursor: pointer;
  }
  .gjs-trt-trait select option {
    background: hsl(var(--popover)) !important;
    color: hsl(var(--popover-foreground)) !important;
  }

  /* Mensagem "Selecione um campo" quando nada esta selecionado */
  .traits-container:empty::before,
  .traits-container .gjs-traits:empty::before {
    content: 'Selecione um campo no canvas para ver suas propriedades';
    display: block;
    padding: 24px 16px;
    text-align: center;
    font-size: 13px;
    color: hsl(var(--muted-foreground));
    line-height: 1.5;
  }

  /* ━━━ Resize handles ━━━ */
  .gjs-resizer-h {
    border-color: #3b82f6 !important;
    border-radius: 2px;
    background: #3b82f6 !important;
    opacity: 0.9;
  }
  .gjs-resizer-h:hover {
    opacity: 1;
    transform: scale(1.2);
  }

  /* ━━━ Toolbar / badge do componente selecionado ━━━ */
  .gjs-toolbar {
    background: #3b82f6 !important;
    border-radius: 4px 4px 0 0 !important;
    padding: 2px 4px !important;
  }
  .gjs-toolbar-item {
    font-size: 12px !important;
    padding: 2px 4px !important;
    color: #fff !important;
    border-radius: 3px;
  }
  .gjs-toolbar-item:hover {
    background: rgba(255,255,255,0.2) !important;
  }

  /* ━━━ Badge (nome do componente ao hover/selecionar) ━━━ */
  .gjs-badge {
    background: #3b82f6 !important;
    color: #fff !important;
    font-size: 10px !important;
    padding: 1px 6px !important;
    border-radius: 3px !important;
  }

  /* ━━━ Highlighter (borda ao passar mouse sobre componente) ━━━ */
  .gjs-highlighter {
    outline: 1px dashed #3b82f6 !important;
    border-radius: 4px;
  }

  /* ━━━ Canvas frame — centralizar o formulario ━━━ */
  .gjs-frame { border: none !important; }
`;
