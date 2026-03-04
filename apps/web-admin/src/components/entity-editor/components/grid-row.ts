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
        copyable: true,
        removable: true,
        highlightable: true,
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
              border-radius: 6px;
              padding: 16px;
              text-align: center;
              color: var(--muted-fg, #a1a1aa);
              font-size: 13px;
            ">
              Arraste campos aqui
            </div>
          `;
        }
      },
    },
  });
}
