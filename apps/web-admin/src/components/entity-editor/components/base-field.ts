import type { Editor } from 'grapesjs';
import { renderFieldByType } from '../utils/field-renderer';

/**
 * Component type `crm-field` — base para todos os 47 tipos de campo.
 * Cada tipo estende este component type adicionando traits especificos.
 */
export function registerBaseField(editor: Editor) {
  editor.DomComponents.addType('crm-field', {
    model: {
      defaults: {
        tagName: 'div',
        name: 'Campo',
        droppable: false,
        copyable: true,
        removable: true,
        // Pode ser arrastado para grid-cell (ideal), grid-row (auto-wrap) ou wrapper (nova row)
        draggable: true,
        highlightable: true,
        // Resize: handles laterais (cl, cr) e inferior (bc)
        // Logica de conversao px→colSpan centralizada em grapejs-editor.tsx
        resizable: {
          tl: 0, tc: 0, tr: 0,
          bl: 0, bc: 0, br: 0,
          cl: 1, cr: 1,
          step: 1,
          minDim: 50,
          maxDim: 2000,
        },

        // Toolbar: acoes rapidas ao selecionar o campo
        toolbar: [
          {
            attributes: { class: 'fa fa-arrows gjs-no-touch-actions', title: 'Mover' },
            command: 'tlb-move',
          },
          {
            attributes: { class: 'fa fa-clone', title: 'Duplicar' },
            command: 'tlb-clone',
          },
          {
            attributes: { class: 'fa fa-trash-o', title: 'Remover' },
            command: 'tlb-delete',
          },
        ],

        // === Propriedades do campo (mapeiam para EntityField) ===
        fieldName: '',
        fieldLabel: '',
        fieldType: 'text',
        fieldRequired: false,
        fieldPlaceholder: '',
        fieldHelpText: '',
        fieldDefault: '',
        fieldHidden: false,
        fieldDisabled: false,
        fieldUnique: false,

        // Opcoes (select, multiselect, radio, checkbox, tags)
        fieldOptions: '[]',

        // Relation
        fieldRelatedEntityId: '',
        fieldRelatedEntitySlug: '',
        fieldRelatedDisplayField: '',

        // Sub-entity
        fieldSubEntityId: '',
        fieldSubEntitySlug: '',
        fieldSubEntityDisplayFields: '[]',

        // Number/currency
        fieldMin: '',
        fieldMax: '',
        fieldStep: '',
        fieldPrefix: '',
        fieldSuffix: '',

        // Map
        fieldMapMode: 'both',
        fieldMapHeight: 200,

        // Image/File
        fieldMultiple: false,
        fieldMaxFiles: 10,
        fieldImageSource: 'both',

        // Api-select
        fieldApiEndpoint: '',
        fieldValueField: 'id',
        fieldLabelField: '',

        // Configs complexos (serializados como JSON string)
        fieldWorkflowConfig: '',
        fieldTimerConfig: '',
        fieldSlaConfig: '',
        fieldFormulaConfig: '',
        fieldRollupConfig: '',
        fieldLookupConfig: '',
        fieldActionButtonConfig: '',
        fieldUserSelectConfig: '',
        fieldTagsConfig: '',
        fieldSignatureConfig: '',
        fieldCheckboxGroupConfig: '',
        fieldRadioGroupConfig: '',

        // Zone diagram
        fieldDiagramSaveMode: 'object',
        fieldDiagramImage: '',
        fieldDiagramZones: '[]',

        // Validation/conditional
        fieldValidators: '[]',
        fieldVisibleIf: '',
        fieldRequiredIf: '',
        fieldReadOnlyIf: '',
        fieldCrossFieldValidation: '',

        // AutoFill
        fieldAutoFillFields: '[]',
        fieldOnChangeAutoFill: '[]',

        // Grid — editavel pelo usuario, sincronizado com grid-cell pai
        // Usar string para consistencia com o select trait (que retorna strings)
        fieldColSpan: '12',

        // Grid posicao (informativo, gerenciado pelo grid-cell pai)
        fieldGridRow: 0,
        fieldGridColSpan: 12,
        fieldGridColStart: 0,

        // Traits vazio — painel de propriedades e gerenciado via React (FieldPropertiesPanel)
        traits: [],
      },

      init() {
        // Re-renderizar quando propriedades visuais mudam
        this.on('change:fieldLabel', this.triggerRender);
        this.on('change:fieldRequired', this.triggerRender);
        this.on('change:fieldPlaceholder', this.triggerRender);
        this.on('change:fieldType', this.triggerRender);
        this.on('change:fieldOptions', this.triggerRender);
        this.on('change:fieldHidden', this.triggerRender);
        this.on('change:fieldDiagramImage', this.triggerRender);
        this.on('change:fieldDiagramZones', this.triggerRender);
        this.on('change:fieldRelatedEntitySlug', this.triggerRender);
        this.on('change:fieldRelatedDisplayField', this.triggerRender);
        this.on('change:fieldSubEntitySlug', this.triggerRender);
        this.on('change:fieldApiEndpoint', this.triggerRender);

        // Sincronizar largura do campo com a celula pai
        this.on('change:fieldColSpan', this.syncGridSpan);
      },

      syncGridSpan() {
        const rawColSpan = this.get('fieldColSpan');
        let colSpan = Math.min(12, Math.max(1, parseInt(String(rawColSpan), 10) || 12));
        const cell = this.parent();
        if (!cell || cell.get('type') !== 'grid-cell') return;

        const row = cell.parent();
        if (!row || row.get('type') !== 'grid-row') {
          if (cell.get('colSpan') !== colSpan) cell.set('colSpan', colSpan);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allCells: any[] = row.components().filter(
          (c: any) => c.get('type') === 'grid-cell',
        );
        const MIN_COL = 2;

        if (allCells.length > 1) {
          const otherCells = allCells.filter((c: any) => c !== cell);
          const maxForThis = 12 - otherCells.length * MIN_COL;
          colSpan = Math.min(colSpan, maxForThis);
          colSpan = Math.max(MIN_COL, colSpan);

          if (cell.get('colSpan') !== colSpan) cell.set('colSpan', colSpan);

          const remaining = 12 - colSpan;
          const perOther = Math.floor(remaining / otherCells.length);
          otherCells.forEach((other: any, i: number) => {
            const span = i === otherCells.length - 1
              ? remaining - perOther * (otherCells.length - 1)
              : perOther;
            const s = Math.max(MIN_COL, span);
            if (other.get('colSpan') !== s) other.set('colSpan', s);
            // Atualizar o campo dentro da celula irma
            const otherField = other.components().find(
              (c: any) => c.get('type')?.startsWith('crm-field'),
            );
            if (otherField) otherField.set('fieldColSpan', String(s));
          });
        } else {
          if (cell.get('colSpan') !== colSpan) cell.set('colSpan', colSpan);
        }
      },

      triggerRender() {
        // Forca re-render da view
        this.view?.onRender();
      },
    },

    view: {
      onRender() {
        const model = this.model;
        const type = model.get('fieldType') || 'text';
        const label = model.get('fieldLabel') || model.get('fieldName') || 'Campo';
        const required = model.get('fieldRequired');
        const placeholder = model.get('fieldPlaceholder') || '';
        const helpText = model.get('fieldHelpText') || '';
        const isHidden = model.get('fieldHidden');
        const optionsStr = model.get('fieldOptions') || '[]';

        let options: Array<{ value: string; label: string }> = [];
        try {
          const parsed = JSON.parse(optionsStr);
          options = Array.isArray(parsed)
            ? parsed.map((o: string | { value: string; label: string }) =>
                typeof o === 'string' ? { value: o, label: o } : o,
              )
            : [];
        } catch {
          options = [];
        }

        if (isHidden) {
          this.el.innerHTML = `
            <div class="crm-field-preview">
              <div class="crm-hidden-indicator">
                <span>👁</span> ${label} (campo oculto)
              </div>
            </div>
          `;
          return;
        }

        // Zone diagram: extrair imagem e zonas reais
        let diagramImage: string | undefined;
        let diagramZones: Array<{ id: string; label: string | number; x: number; y: number }> | undefined;
        if (type === 'zone-diagram') {
          diagramImage = model.get('fieldDiagramImage') || undefined;
          const zonesStr = model.get('fieldDiagramZones') || '[]';
          try {
            const parsed = JSON.parse(zonesStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              diagramZones = parsed;
            }
          } catch { /* ignore */ }
        }

        // Entity reference info for relation/api-select/sub-entity
        const entitySlug = model.get('fieldRelatedEntitySlug') || '';
        const displayField = model.get('fieldRelatedDisplayField') || '';
        const apiEndpoint = model.get('fieldApiEndpoint') || '';
        const subEntitySlug = model.get('fieldSubEntitySlug') || '';

        const fieldHtml = renderFieldByType(type, {
          placeholder,
          options,
          diagramImage,
          diagramZones,
          entitySlug,
          displayField,
          apiEndpoint,
          subEntitySlug,
          label: model.get('fieldWorkflowConfig')
            ? (() => {
                try {
                  const wc = JSON.parse(model.get('fieldWorkflowConfig'));
                  return wc.statuses?.[0]?.label || 'Status';
                } catch { return 'Status'; }
              })()
            : undefined,
          actionLabel: model.get('fieldActionButtonConfig')
            ? (() => {
                try {
                  const ac = JSON.parse(model.get('fieldActionButtonConfig'));
                  return ac.label || 'Acao';
                } catch { return 'Acao'; }
              })()
            : undefined,
        });

        const helpHtml = helpText
          ? `<p class="crm-help-text">${helpText}</p>`
          : '';

        // Section title e um caso especial
        if (type === 'section-title') {
          this.el.innerHTML = `
            <div class="crm-field-preview">
              <div class="crm-section-title">${label}</div>
            </div>
          `;
          return;
        }

        this.el.innerHTML = `
          <div class="crm-field-preview">
            <label>
              ${label}${required ? '<span class="required-mark">*</span>' : ''}
            </label>
            ${fieldHtml}
            ${helpHtml}
          </div>
        `;
      },
    },
  });
}
