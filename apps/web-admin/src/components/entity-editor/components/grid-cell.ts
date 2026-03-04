import type { Editor } from 'grapesjs';

/**
 * Component type `grid-cell` — celula do grid (1-12 colunas).
 * Aceita componentes `crm-field-*` como filhos.
 * Propriedade `colSpan` controla a largura.
 * Auto-remove quando fica vazia (campo deletado).
 */
export function registerGridCell(editor: Editor) {
  editor.DomComponents.addType('grid-cell', {
    model: {
      defaults: {
        tagName: 'div',
        name: 'Celula',
        draggable: '[data-gjs-type="grid-row"]',
        // Aceita campos crm-field-*
        droppable: true,
        copyable: false,
        removable: true,
        selectable: false,
        highlightable: true,
        resizable: {
          // Permitir resize horizontal (para mudar colSpan)
          tl: 0, tc: 0, tr: 0,
          bl: 0, bc: 0, br: 0,
          cl: 1, cr: 1,
          step: 1,
          minDim: 1,
          maxDim: 12,
        },
        attributes: { class: 'grid-cell col-span-12' },
        colSpan: 12,
        traits: [
          {
            type: 'number',
            name: 'colSpan',
            label: 'Colunas',
            min: 1,
            max: 12,
            changeProp: true,
          },
        ],
      },
      init() {
        this.on('change:colSpan', this.updateColSpan);

        // Quando um filho e removido, verificar se a celula ficou vazia
        this.on('component:remove', () => {
          // Usar setTimeout para esperar o GrapeJS terminar a operacao
          setTimeout(() => {
            if (this.components().length === 0) {
              const row = this.parent();
              this.remove();
              // Redistribuir colSpan das celulas restantes na row
              if (row && row.get('type') === 'grid-row') {
                redistributeColSpans(row);
                // Se a row ficou vazia, remover tambem
                if (row.components().length === 0) {
                  row.remove();
                }
              }
            }
          }, 0);
        });
      },
      updateColSpan() {
        const span = Math.min(12, Math.max(1, this.get('colSpan') || 12));
        const classes = this.getClasses().filter(
          (c: string) => !c.startsWith('col-span-'),
        );
        classes.push(`col-span-${span}`);
        this.setClass(classes);
      },
    },
    view: {
      onRender() {
        const span = this.model.get('colSpan') || 12;
        this.el.className = `grid-cell col-span-${span}`;
      },
    },
  });
}

/**
 * Redistribui o colSpan das celulas de uma row igualmente.
 */
function redistributeColSpans(row: { components: () => { filter: (fn: (c: { get: (k: string) => string }) => boolean) => Array<{ set: (k: string, v: unknown) => void; setClass: (c: string[]) => void }> } }) {
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
    cell.setClass(['grid-cell', `col-span-${span}`]);
  });
}
