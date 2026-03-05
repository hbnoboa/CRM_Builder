import type { Editor } from 'grapesjs';

/**
 * Component type `grid-cell` — celula do grid (1-12 colunas).
 * Aceita componentes `crm-field-*` como filhos.
 * Propriedade `colSpan` controla a largura.
 * Auto-remove quando fica vazia (campo deletado).
 *
 * Classes: usar addClass/removeClass do GrapeJS para manter o model.classes
 * sincronizado com o DOM. O model.classes e o que getProjectData() serializa.
 */
export function registerGridCell(editor: Editor) {
  editor.DomComponents.addType('grid-cell', {
    model: {
      defaults: {
        tagName: 'div',
        name: 'Celula',
        draggable: '[data-gjs-type="grid-row"]',
        // droppable: false forca o sorter a "subir" para o grid-row pai.
        // Com display:flex no row, o sorter mostra indicadores horizontais (esq/dir)
        // entre as cells, ao inves de apenas acima/abaixo dentro de uma cell.
        droppable: false,
        copyable: false,
        removable: true,
        selectable: false,
        highlightable: false,
        attributes: { class: 'grid-cell col-span-12' },
        colSpan: 12,
        traits: [],
      },
      init() {
        this.on('change:colSpan', this.updateGridSpan);

        // Escutar diretamente a collection de filhos (nao 'component:remove' que
        // e um evento do EDITOR, nao do model — nunca disparava para filhos!)
        this.listenTo(this.get('components'), 'remove', () => {
          // Delay de 300ms para dar tempo ao component:add E component:drag:end
          // de processarem primeiro (evita race conditions durante drag-drop)
          setTimeout(() => {
            if (this.components().length === 0) {
              const row = this.parent();
              this.remove();
              if (row && row.get('type') === 'grid-row' && row.components().length > 0) {
                redistributeColSpans(row);
              }
              if (row && row.get('type') === 'grid-row' && row.components().length === 0) {
                row.remove();
              }
            }
          }, 300);
        });
      },
      updateGridSpan() {
        const colSpan = Math.min(12, Math.max(1, this.get('colSpan') || 12));

        // Atualizar model.classes via API do GrapeJS — isto atualiza TANTO
        // o model (para serializacao via getProjectData) QUANTO o DOM.
        const currentClasses: string[] = this.getClasses?.() || [];
        const toRemove = currentClasses.filter(
          (cls: string) => cls.startsWith('col-span-'),
        );
        toRemove.forEach((cls: string) => this.removeClass?.(cls));
        this.addClass?.(`col-span-${colSpan}`);
        if (!this.getClasses?.().includes('grid-cell')) this.addClass?.('grid-cell');
      },
    },
    view: {
      onRender() {
        const colSpan = this.model.get('colSpan') || 12;
        this.el.classList.add('grid-cell', `col-span-${colSpan}`);
      },
    },
  });
}

/**
 * Redistribui o colSpan das celulas de uma row igualmente.
 * NAO chama setClass() — updateGridSpan cuida via change:colSpan.
 */
function redistributeColSpans(row: { components: () => { filter: (fn: (c: { get: (k: string) => string }) => boolean) => Array<{ set: (k: string, v: unknown) => void }> } }) {
  const cells = row.components().filter(
    (c: { get: (k: string) => string }) => c.get('type') === 'grid-cell',
  );
  if (cells.length === 0) return;

  const spanPerCell = Math.max(1, Math.floor(12 / cells.length));
  cells.forEach((cell, index) => {
    const span = index === cells.length - 1
      ? 12 - spanPerCell * (cells.length - 1)
      : spanPerCell;
    cell.set('colSpan', span);
  });
}
