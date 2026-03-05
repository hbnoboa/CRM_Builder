import type { Editor } from 'grapesjs';
import { renderFieldByType } from '../utils/field-renderer';

// Trait categories para organizar o painel de propriedades
const CAT_BASIC = { id: 'basic', label: 'Basico', open: true };
const CAT_APPEARANCE = { id: 'appearance', label: 'Aparencia', open: false };
const CAT_LAYOUT = { id: 'layout', label: 'Layout', open: false };
const CAT_ADVANCED = { id: 'advanced', label: 'Avancado', open: false };

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

        // Traits comuns (exibidos para todos os tipos)
        traits: [
          {
            type: 'text',
            name: 'fieldName',
            label: 'Slug',
            placeholder: 'nome_do_campo',
            changeProp: true,
            category: CAT_BASIC,
          },
          {
            type: 'text',
            name: 'fieldLabel',
            label: 'Label',
            placeholder: 'Nome exibido',
            changeProp: true,
            category: CAT_BASIC,
          },
          {
            type: 'checkbox',
            name: 'fieldRequired',
            label: 'Obrigatorio',
            changeProp: true,
            category: CAT_BASIC,
          },
          {
            type: 'text',
            name: 'fieldPlaceholder',
            label: 'Placeholder',
            changeProp: true,
            category: CAT_APPEARANCE,
          },
          {
            type: 'text',
            name: 'fieldHelpText',
            label: 'Texto de ajuda',
            changeProp: true,
            category: CAT_APPEARANCE,
          },
          {
            type: 'text',
            name: 'fieldDefault',
            label: 'Valor padrao',
            changeProp: true,
            category: CAT_APPEARANCE,
          },
          {
            type: 'select',
            name: 'fieldColSpan',
            label: 'Largura',
            changeProp: true,
            category: CAT_LAYOUT,
            options: [
              { id: '1', label: '1/12' },
              { id: '2', label: '2/12' },
              { id: '3', label: '3/12 (1/4)' },
              { id: '4', label: '4/12 (1/3)' },
              { id: '5', label: '5/12' },
              { id: '6', label: '6/12 (1/2)' },
              { id: '7', label: '7/12' },
              { id: '8', label: '8/12 (2/3)' },
              { id: '9', label: '9/12 (3/4)' },
              { id: '10', label: '10/12' },
              { id: '11', label: '11/12' },
              { id: '12', label: '12/12 (Inteiro)' },
            ],
          },
          {
            type: 'checkbox',
            name: 'fieldHidden',
            label: 'Oculto',
            changeProp: true,
            category: CAT_ADVANCED,
          },
          {
            type: 'checkbox',
            name: 'fieldUnique',
            label: 'Unico',
            changeProp: true,
            category: CAT_ADVANCED,
          },
        ],
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

        // Sincronizar largura do campo com a celula pai
        this.on('change:fieldColSpan', this.syncGridSpan);
      },

      syncGridSpan() {
        const rawColSpan = this.get('fieldColSpan');
        const colSpan = Math.min(12, Math.max(1, parseInt(String(rawColSpan), 10) || 12));
        const cell = this.parent();
        if (cell && cell.get('type') === 'grid-cell') {
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
        let diagramZones: Array<{ id: string; label: string; x: number; y: number }> | undefined;
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

        const fieldHtml = renderFieldByType(type, {
          placeholder,
          options,
          diagramImage,
          diagramZones,
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
