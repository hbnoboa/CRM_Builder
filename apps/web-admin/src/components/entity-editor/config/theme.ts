/**
 * CSS injetado no iframe do canvas do GrapeJS.
 * Espelha o design system (shadcn/ui + Tailwind) para WYSIWYG.
 */
export function getCanvasStyles(isDark: boolean): string {
  const bg = isDark ? '#09090b' : '#ffffff';
  const fg = isDark ? '#fafafa' : '#09090b';
  const muted = isDark ? '#27272a' : '#f4f4f5';
  const mutedFg = isDark ? '#a1a1aa' : '#71717a';
  const border = isDark ? '#27272a' : '#e4e4e7';
  const primary = isDark ? '#3b82f6' : '#2563eb';
  const destructive = isDark ? '#ef4444' : '#dc2626';
  const input = isDark ? '#27272a' : '#e4e4e7';
  const ring = isDark ? '#3b82f6' : '#2563eb';
  const accent = isDark ? '#27272a' : '#f4f4f5';

  return `data:text/css,${encodeURIComponent(`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${bg};
      color: ${fg};
      padding: 24px;
      font-size: 14px;
      line-height: 1.5;
    }

    /* Grid System */
    .grid-row {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 16px;
      margin-bottom: 16px;
      min-height: 60px;
      padding: 4px;
      border-radius: 8px;
      transition: background 0.15s;
    }
    .grid-row:hover { background: ${accent}; }
    .grid-row[data-gjs-hoverable] { outline: 1px dashed ${border}; }

    .grid-cell {
      min-height: 40px;
      border-radius: 6px;
      transition: outline 0.15s;
    }
    .grid-cell:empty {
      border: 2px dashed ${border};
      border-radius: 6px;
      min-height: 60px;
    }
    .grid-cell[data-gjs-hoverable] { outline: 1px dashed ${ring}; }

    /* colSpan classes */
    .col-span-1 { grid-column: span 1; }
    .col-span-2 { grid-column: span 2; }
    .col-span-3 { grid-column: span 3; }
    .col-span-4 { grid-column: span 4; }
    .col-span-5 { grid-column: span 5; }
    .col-span-6 { grid-column: span 6; }
    .col-span-7 { grid-column: span 7; }
    .col-span-8 { grid-column: span 8; }
    .col-span-9 { grid-column: span 9; }
    .col-span-10 { grid-column: span 10; }
    .col-span-11 { grid-column: span 11; }
    .col-span-12 { grid-column: span 12; }

    /* Field Base */
    .crm-field-preview {
      padding: 8px;
    }
    .crm-field-preview label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 6px;
      color: ${fg};
      line-height: 1;
    }
    .crm-field-preview .required-mark {
      color: ${destructive};
      margin-left: 4px;
    }

    /* Input base */
    .crm-input {
      display: flex;
      height: 40px;
      width: 100%;
      border-radius: 6px;
      border: 1px solid ${input};
      background: ${bg};
      padding: 8px 12px;
      font-size: 14px;
      color: ${fg};
      outline: none;
      transition: border-color 0.15s;
    }
    .crm-input::placeholder { color: ${mutedFg}; }
    .crm-input:focus { border-color: ${ring}; box-shadow: 0 0 0 2px ${ring}33; }

    /* Textarea */
    .crm-textarea {
      display: flex;
      min-height: 80px;
      width: 100%;
      border-radius: 6px;
      border: 1px solid ${input};
      background: ${bg};
      padding: 8px 12px;
      font-size: 14px;
      color: ${fg};
      resize: vertical;
    }

    /* Select */
    .crm-select {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 40px;
      width: 100%;
      border-radius: 6px;
      border: 1px solid ${input};
      background: ${bg};
      padding: 8px 12px;
      font-size: 14px;
      color: ${mutedFg};
      cursor: pointer;
    }
    .crm-select-arrow { font-size: 10px; color: ${mutedFg}; }

    /* Switch/Toggle */
    .crm-switch {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .crm-switch-track {
      width: 36px;
      height: 20px;
      border-radius: 10px;
      background: ${muted};
      position: relative;
    }
    .crm-switch-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: white;
      position: absolute;
      top: 2px;
      left: 2px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.15);
    }
    .crm-switch-label { font-size: 14px; color: ${mutedFg}; }

    /* File/Image drop zone */
    .crm-dropzone {
      border: 2px dashed ${border};
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      color: ${mutedFg};
      font-size: 13px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .crm-dropzone-icon { font-size: 24px; margin-bottom: 4px; }

    /* Map placeholder */
    .crm-map-placeholder {
      border: 1px solid ${border};
      border-radius: 8px;
      background: ${muted};
      height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${mutedFg};
      font-size: 14px;
    }

    /* Rating */
    .crm-rating {
      display: flex;
      gap: 4px;
      font-size: 20px;
      color: ${mutedFg};
    }
    .crm-rating-star { opacity: 0.3; }
    .crm-rating-star.filled { opacity: 1; color: #f59e0b; }

    /* Slider */
    .crm-slider-track {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: ${muted};
      position: relative;
    }
    .crm-slider-fill {
      width: 50%;
      height: 100%;
      border-radius: 3px;
      background: ${primary};
    }
    .crm-slider-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: ${primary};
      position: absolute;
      top: -5px;
      left: calc(50% - 8px);
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    /* Color picker preview */
    .crm-color-preview {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .crm-color-swatch {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: 1px solid ${border};
      background: ${primary};
    }

    /* Section title */
    .crm-section-title {
      font-size: 16px;
      font-weight: 600;
      color: ${fg};
      border-bottom: 2px solid ${border};
      padding-bottom: 8px;
    }

    /* Signature placeholder */
    .crm-signature-placeholder {
      border: 1px solid ${border};
      border-radius: 8px;
      background: ${bg};
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${mutedFg};
      font-size: 14px;
    }

    /* Input with icon */
    .crm-input-with-icon {
      position: relative;
    }
    .crm-input-with-icon .crm-input {
      padding-right: 36px;
    }
    .crm-input-icon {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: ${mutedFg};
      font-size: 14px;
    }

    /* Badge for tags */
    .crm-tag {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
      background: ${accent};
      color: ${fg};
      border: 1px solid ${border};
    }

    /* Hidden field indicator */
    .crm-hidden-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: ${muted};
      border-radius: 6px;
      color: ${mutedFg};
      font-size: 13px;
      font-style: italic;
    }

    /* JSON field */
    .crm-json-preview {
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 12px;
      padding: 8px 12px;
      background: ${muted};
      border-radius: 6px;
      color: ${mutedFg};
      border: 1px solid ${border};
      min-height: 60px;
    }

    /* Checkbox group */
    .crm-checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .crm-checkbox-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: ${fg};
    }
    .crm-checkbox-box {
      width: 16px;
      height: 16px;
      border: 2px solid ${input};
      border-radius: 4px;
      background: ${bg};
    }

    /* Radio group */
    .crm-radio-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .crm-radio-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: ${fg};
    }
    .crm-radio-circle {
      width: 16px;
      height: 16px;
      border: 2px solid ${input};
      border-radius: 50%;
      background: ${bg};
    }

    /* Action button */
    .crm-action-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 36px;
      padding: 0 16px;
      border-radius: 6px;
      background: ${primary};
      color: white;
      font-size: 14px;
      font-weight: 500;
      border: none;
      cursor: pointer;
    }

    /* Timer display */
    .crm-timer {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'Fira Code', monospace;
      font-size: 16px;
      color: ${fg};
    }

    /* GrapeJS overrides - selected component */
    .gjs-selected {
      outline: 2px solid ${primary} !important;
      outline-offset: 2px;
    }
    .gjs-hovered {
      outline: 1px dashed ${ring} !important;
    }
  `)}`;
}

/**
 * CSS para o editor GrapeJS (fora do iframe, UI do editor)
 */
export const editorStyles = `
  .gjs-one-bg { background-color: hsl(var(--background)); }
  .gjs-two-color { color: hsl(var(--foreground)); }
  .gjs-three-bg { background-color: hsl(var(--muted)); }
  .gjs-four-color, .gjs-four-color-h:hover { color: hsl(var(--primary)); }
`;
