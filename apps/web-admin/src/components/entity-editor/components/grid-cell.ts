import type { Editor } from 'grapesjs';

/**
 * Component type `grid-cell` — celula do grid (1-12 colunas).
 * Aceita componentes `crm-field-*` como filhos.
 * Propriedade `colSpan` controla a largura.
 * Auto-remove quando fica vazia (campo deletado).
 *
 * IMPORTANTE: Nunca usar setClass() — ele substitui TODAS as classes,
 * removendo classes do GrapeJS (gjs-selected, gjs-comp-highlighted).
 * Usar classList.add/remove para manipulacao cirurgica.
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
        rowSpan: 1,
        traits: [],
      },
      init() {
        this.on('change:colSpan', this.updateGridSpan);
        this.on('change:rowSpan', this.updateGridSpan);

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
        const rowSpan = Math.max(1, this.get('rowSpan') || 1);
        const el = this.view?.el;
        if (el) {
          // Remover apenas col-span-* e row-span-* sem tocar em classes do GrapeJS
          const toRemove: string[] = [];
          el.classList.forEach((cls: string) => {
            if (cls.startsWith('col-span-') || cls.startsWith('row-span-')) {
              toRemove.push(cls);
            }
          });
          toRemove.forEach((cls) => el.classList.remove(cls));
          el.classList.add('grid-cell', `col-span-${colSpan}`);
          if (rowSpan > 1) el.classList.add(`row-span-${rowSpan}`);
        }
      },
    },
    view: {
      onRender() {
        const colSpan = this.model.get('colSpan') || 12;
        const rowSpan = this.model.get('rowSpan') || 1;
        // classList ao inves de className = ... para preservar classes do GrapeJS
        this.el.classList.add('grid-cell', `col-span-${colSpan}`);
        if (rowSpan > 1) this.el.classList.add(`row-span-${rowSpan}`);
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
    // Ultima celula pega o restante
    const span = index === cells.length - 1
      ? 12 - spanPerCell * (cells.length - 1)
      : spanPerCell;
    cell.set('colSpan', span);
    // NAO chamar setClass() — updateGridSpan ja cuida via change:colSpan
  });
}
