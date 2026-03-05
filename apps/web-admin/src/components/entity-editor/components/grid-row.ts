import type { Editor } from 'grapesjs';

/**
 * Component type `grid-row` — linha do grid 12-colunas.
 * Aceita `grid-cell` e campos `crm-field-*` como filhos.
 * Quando um campo e solto diretamente na row, ele e auto-envolvido
 * em um grid-cell e o colSpan das celulas e redistribuido.
 */
export function registerGridRow(editor: Editor) {
  editor.DomComponents.addType('grid-row', {
    model: {
      defaults: {
        tagName: 'div',
        name: 'Linha',
        draggable: '[data-gjs-type="wrapper"]',
        // Aceitar grid-cells E campos crm-field-* diretamente
        droppable: true,
        selectable: false,
        copyable: false,
        removable: true,
        highlightable: false,
        attributes: { class: 'grid-row' },
        styles: '',
        traits: [],
      },
    },
    view: {
      onRender() {
        // Se a row esta vazia, mostrar placeholder
        if (this.model.components().length === 0) {
          this.el.innerHTML = `
            <div style="
              grid-column: span 12;
              border: 2px dashed var(--border, #e4e4e7);
              border-radius: 8px;
              padding: 24px 16px;
              text-align: center;
              color: var(--muted-fg, #a1a1aa);
              font-size: 13px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              background: var(--muted-bg, transparent);
              transition: border-color 0.2s, background 0.2s;
            ">
              <span style="font-size: 18px;">+</span>
              Arraste um campo aqui ou use o botao "Adicionar Campo"
            </div>
          `;
        }
      },
    },
  });
}
