import type { Editor } from 'grapesjs';

/**
 * Registra todos os 47 tipos de campo como component types no GrapeJS.
 * Cada tipo estende `crm-field` adicionando traits especificos do tipo.
 */
export function registerFieldTypes(editor: Editor) {
  // ─── Texto ─────────────────────────────────────────────────────────────
  registerType(editor, 'crm-field-text', 'text', 'Texto', [
    { type: 'number', name: 'fieldMaxLength', label: 'Tamanho maximo', changeProp: true },
    { type: 'select', name: 'fieldTextTransform', label: 'Transformacao', changeProp: true,
      options: [
        { id: '', name: 'Nenhuma' },
        { id: 'uppercase', name: 'MAIUSCULAS' },
        { id: 'lowercase', name: 'minusculas' },
        { id: 'titlecase', name: 'Titulo' },
      ],
    },
  ]);

  registerType(editor, 'crm-field-textarea', 'textarea', 'Area de texto', [
    { type: 'number', name: 'fieldRows', label: 'Linhas', min: 2, max: 20, changeProp: true },
    { type: 'number', name: 'fieldMaxLength', label: 'Tamanho maximo', changeProp: true },
  ]);

  registerType(editor, 'crm-field-richtext', 'richtext', 'Texto rico', []);

  registerType(editor, 'crm-field-email', 'email', 'Email', []);
  registerType(editor, 'crm-field-url', 'url', 'URL', []);
  registerType(editor, 'crm-field-password', 'password', 'Senha', []);

  registerType(editor, 'crm-field-array', 'array', 'Lista', [
    { type: 'number', name: 'fieldMaxItems', label: 'Maximo de itens', changeProp: true },
  ]);

  // ─── Numeros ───────────────────────────────────────────────────────────
  registerType(editor, 'crm-field-number', 'number', 'Numero', [
    { type: 'number', name: 'fieldMin', label: 'Minimo', changeProp: true },
    { type: 'number', name: 'fieldMax', label: 'Maximo', changeProp: true },
    { type: 'number', name: 'fieldStep', label: 'Incremento', changeProp: true },
  ]);

  registerType(editor, 'crm-field-currency', 'currency', 'Moeda', [
    { type: 'text', name: 'fieldPrefix', label: 'Prefixo', placeholder: 'R$', changeProp: true },
    { type: 'number', name: 'fieldDecimalPlaces', label: 'Casas decimais', min: 0, max: 4, changeProp: true },
  ]);

  registerType(editor, 'crm-field-percentage', 'percentage', 'Percentual', [
    { type: 'number', name: 'fieldMin', label: 'Minimo', changeProp: true },
    { type: 'number', name: 'fieldMax', label: 'Maximo', changeProp: true },
    { type: 'number', name: 'fieldDecimalPlaces', label: 'Casas decimais', min: 0, max: 4, changeProp: true },
  ]);

  registerType(editor, 'crm-field-slider', 'slider', 'Slider', [
    { type: 'number', name: 'fieldMin', label: 'Minimo', changeProp: true },
    { type: 'number', name: 'fieldMax', label: 'Maximo', changeProp: true },
    { type: 'number', name: 'fieldStep', label: 'Incremento', changeProp: true },
  ]);

  registerType(editor, 'crm-field-rating', 'rating', 'Avaliacao', [
    { type: 'number', name: 'fieldMax', label: 'Nota maxima', min: 1, max: 10, changeProp: true },
  ]);

  // ─── Contato / Documentos / Mascaras ───────────────────────────────────
  registerType(editor, 'crm-field-phone', 'phone', 'Telefone', []);
  registerType(editor, 'crm-field-cpf', 'cpf', 'CPF', []);
  registerType(editor, 'crm-field-cnpj', 'cnpj', 'CNPJ', []);
  registerType(editor, 'crm-field-cep', 'cep', 'CEP', []);

  // ─── Datas ─────────────────────────────────────────────────────────────
  registerType(editor, 'crm-field-date', 'date', 'Data', [
    { type: 'checkbox', name: 'fieldDisablePast', label: 'Bloquear datas passadas', changeProp: true },
    { type: 'checkbox', name: 'fieldDisableFuture', label: 'Bloquear datas futuras', changeProp: true },
  ]);

  registerType(editor, 'crm-field-datetime', 'datetime', 'Data e hora', [
    { type: 'checkbox', name: 'fieldDisablePast', label: 'Bloquear passadas', changeProp: true },
    { type: 'checkbox', name: 'fieldDisableFuture', label: 'Bloquear futuras', changeProp: true },
  ]);

  registerType(editor, 'crm-field-time', 'time', 'Hora', []);

  // ─── Selecao ───────────────────────────────────────────────────────────
  registerType(editor, 'crm-field-boolean', 'boolean', 'Sim/Nao', [
    { type: 'text', name: 'fieldTrueLabel', label: 'Label Sim', placeholder: 'Sim', changeProp: true },
    { type: 'text', name: 'fieldFalseLabel', label: 'Label Nao', placeholder: 'Nao', changeProp: true },
  ]);

  registerType(editor, 'crm-field-select', 'select', 'Select', [
    { type: 'crm-options-editor', name: 'fieldOptions', label: 'Opcoes', changeProp: true },
  ]);

  registerType(editor, 'crm-field-multiselect', 'multiselect', 'Multi-select', [
    { type: 'crm-options-editor', name: 'fieldOptions', label: 'Opcoes', changeProp: true },
    { type: 'number', name: 'fieldMaxItems', label: 'Maximo de itens', changeProp: true },
  ]);

  registerType(editor, 'crm-field-checkbox-group', 'checkbox-group', 'Checkbox Group', [
    { type: 'crm-options-editor', name: 'fieldOptions', label: 'Opcoes', changeProp: true },
    { type: 'select', name: 'fieldLayout', label: 'Layout', changeProp: true,
      options: [
        { id: 'vertical', name: 'Vertical' },
        { id: 'horizontal', name: 'Horizontal' },
        { id: 'grid', name: 'Grid' },
      ],
    },
  ]);

  registerType(editor, 'crm-field-radio-group', 'radio-group', 'Radio Group', [
    { type: 'crm-options-editor', name: 'fieldOptions', label: 'Opcoes', changeProp: true },
    { type: 'select', name: 'fieldLayout', label: 'Layout', changeProp: true,
      options: [
        { id: 'vertical', name: 'Vertical' },
        { id: 'horizontal', name: 'Horizontal' },
      ],
    },
  ]);

  registerType(editor, 'crm-field-tags', 'tags', 'Tags', [
    { type: 'crm-options-editor', name: 'fieldOptions', label: 'Opcoes', changeProp: true },
    { type: 'checkbox', name: 'fieldAllowCustom', label: 'Permitir tags customizadas', changeProp: true },
    { type: 'number', name: 'fieldMaxTags', label: 'Maximo de tags', changeProp: true },
  ]);

  registerType(editor, 'crm-field-color', 'color', 'Cor', [
    { type: 'select', name: 'fieldColorFormat', label: 'Formato', changeProp: true,
      options: [
        { id: 'hex', name: 'HEX' },
        { id: 'rgb', name: 'RGB' },
        { id: 'hsl', name: 'HSL' },
      ],
    },
  ]);

  // ─── Relacoes ──────────────────────────────────────────────────────────
  registerType(editor, 'crm-field-relation', 'relation', 'Relacao', [
    { type: 'crm-entity-select', name: 'fieldRelatedEntityId', label: 'Entidade', changeProp: true },
    { type: 'crm-autofill-editor', name: 'fieldAutoFillFields', label: 'Auto-preenchimento', changeProp: true },
  ]);

  registerType(editor, 'crm-field-sub-entity', 'sub-entity', 'Sub-entidade', [
    { type: 'crm-entity-select', name: 'fieldSubEntityId', label: 'Sub-entidade', changeProp: true },
    { type: 'text', name: 'fieldParentDisplayField', label: 'Campo pai de exibicao', changeProp: true },
    { type: 'textarea', name: 'fieldSubEntityDisplayFields', label: 'Campos de exibicao (JSON)', changeProp: true },
  ]);

  registerType(editor, 'crm-field-lookup', 'lookup', 'Lookup', [
    { type: 'textarea', name: 'fieldLookupConfig', label: 'Config (JSON)', changeProp: true },
  ]);

  registerType(editor, 'crm-field-api-select', 'api-select', 'API Select', [
    { type: 'text', name: 'fieldApiEndpoint', label: 'Endpoint', changeProp: true },
    { type: 'text', name: 'fieldValueField', label: 'Campo valor', placeholder: 'id', changeProp: true },
    { type: 'text', name: 'fieldLabelField', label: 'Campo label', changeProp: true },
    { type: 'textarea', name: 'fieldApiFields', label: 'Campos da API (JSON)', changeProp: true },
    { type: 'crm-autofill-editor', name: 'fieldAutoFillFields', label: 'Auto-preenchimento', changeProp: true },
  ]);

  registerType(editor, 'crm-field-user-select', 'user-select', 'Selecao de usuario', [
    { type: 'textarea', name: 'fieldUserSelectConfig', label: 'Config (JSON)', changeProp: true },
  ]);

  // ─── Arquivos ──────────────────────────────────────────────────────────
  registerType(editor, 'crm-field-file', 'file', 'Arquivo', [
    { type: 'checkbox', name: 'fieldMultiple', label: 'Multiplos arquivos', changeProp: true },
    { type: 'number', name: 'fieldMaxFiles', label: 'Maximo de arquivos', min: 1, max: 50, changeProp: true },
  ]);

  registerType(editor, 'crm-field-image', 'image', 'Imagem', [
    { type: 'checkbox', name: 'fieldMultiple', label: 'Multiplas imagens', changeProp: true },
    { type: 'number', name: 'fieldMaxFiles', label: 'Maximo de imagens', min: 1, max: 50, changeProp: true },
    { type: 'select', name: 'fieldImageSource', label: 'Fonte', changeProp: true,
      options: [
        { id: 'both', name: 'Camera e Galeria' },
        { id: 'camera', name: 'Apenas Camera' },
        { id: 'gallery', name: 'Apenas Galeria' },
      ],
    },
  ]);

  registerType(editor, 'crm-field-signature', 'signature', 'Assinatura', [
    { type: 'textarea', name: 'fieldSignatureConfig', label: 'Config (JSON)', changeProp: true },
  ]);

  // ─── Workflow ──────────────────────────────────────────────────────────
  registerType(editor, 'crm-field-workflow-status', 'workflow-status', 'Status Workflow', [
    { type: 'crm-workflow-editor', name: 'fieldWorkflowConfig', label: 'Workflow', changeProp: true },
  ]);

  registerType(editor, 'crm-field-timer', 'timer', 'Timer', [
    { type: 'textarea', name: 'fieldTimerConfig', label: 'Config timer (JSON)', changeProp: true },
  ]);

  registerType(editor, 'crm-field-sla-status', 'sla-status', 'SLA', [
    { type: 'textarea', name: 'fieldSlaConfig', label: 'Config SLA (JSON)', changeProp: true },
  ]);

  registerType(editor, 'crm-field-action-button', 'action-button', 'Botao de acao', [
    { type: 'textarea', name: 'fieldActionButtonConfig', label: 'Config botao (JSON)', changeProp: true },
  ]);

  // ─── Computados ────────────────────────────────────────────────────────
  registerType(editor, 'crm-field-formula', 'formula', 'Formula', [
    { type: 'textarea', name: 'fieldFormulaConfig', label: 'Config formula (JSON)', changeProp: true },
  ]);

  registerType(editor, 'crm-field-rollup', 'rollup', 'Rollup', [
    { type: 'textarea', name: 'fieldRollupConfig', label: 'Config rollup (JSON)', changeProp: true },
  ]);

  // ─── Layout / Especiais ────────────────────────────────────────────────
  registerType(editor, 'crm-field-section-title', 'section-title', 'Titulo de secao', []);

  registerType(editor, 'crm-field-map', 'map', 'Mapa', [
    { type: 'select', name: 'fieldMapMode', label: 'Modo', changeProp: true,
      options: [
        { id: 'both', name: 'Endereco + Mapa' },
        { id: 'latlng', name: 'Lat/Lng' },
        { id: 'address', name: 'Apenas endereco' },
      ],
    },
    { type: 'number', name: 'fieldMapHeight', label: 'Altura (px)', min: 100, max: 600, changeProp: true },
    { type: 'number', name: 'fieldMapDefaultZoom', label: 'Zoom padrao', min: 1, max: 20, changeProp: true },
  ]);

  registerType(editor, 'crm-field-zone-diagram', 'zone-diagram', 'Diagrama de zonas', [
    { type: 'crm-zone-diagram-editor', name: 'fieldDiagramZones', label: 'Diagrama', changeProp: true },
  ]);

  registerType(editor, 'crm-field-json', 'json', 'JSON', []);
  registerType(editor, 'crm-field-hidden', 'hidden', 'Oculto', []);
}

// ─── Helper ────────────────────────────────────────────────────────────────

function registerType(
  editor: Editor,
  typeName: string,
  fieldType: string,
  displayName: string,
  _extraTraits: unknown[], // mantido para compatibilidade de assinatura
) {
  editor.DomComponents.addType(typeName, {
    extend: 'crm-field',
    model: {
      defaults: {
        name: displayName,
        fieldType,
        // Traits vazio — painel de propriedades e gerenciado via React (FieldPropertiesPanel)
        traits: [],
      },
    },
  });
}
