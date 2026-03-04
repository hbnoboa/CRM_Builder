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

        // Grid (informativo, gerenciado pelo grid-cell pai)
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
          },
          {
            type: 'text',
            name: 'fieldLabel',
            label: 'Label',
            placeholder: 'Nome exibido',
            changeProp: true,
          },
          {
            type: 'checkbox',
            name: 'fieldRequired',
            label: 'Obrigatorio',
            changeProp: true,
          },
          {
            type: 'text',
            name: 'fieldPlaceholder',
            label: 'Placeholder',
            changeProp: true,
          },
          {
            type: 'text',
            name: 'fieldHelpText',
            label: 'Texto de ajuda',
            changeProp: true,
          },
          {
            type: 'text',
            name: 'fieldDefault',
            label: 'Valor padrao',
            changeProp: true,
          },
          {
            type: 'checkbox',
            name: 'fieldHidden',
            label: 'Oculto',
            changeProp: true,
          },
          {
            type: 'checkbox',
            name: 'fieldUnique',
            label: 'Unico',
            changeProp: true,
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

        const fieldHtml = renderFieldByType(type, {
          placeholder,
          options,
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
          ? `<p style="font-size: 12px; color: var(--muted-fg, #71717a); margin-top: 4px;">${helpText}</p>`
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
