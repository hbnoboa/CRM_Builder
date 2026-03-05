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
    { type: 'textarea', name: 'fieldAutoFillFields', label: 'Auto-preenchimento (JSON)', changeProp: true },
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
    { type: 'textarea', name: 'fieldAutoFillFields', label: 'Auto-preenchimento (JSON)', changeProp: true },
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

// Trait categories — mesmas do base-field.ts
const CAT_BASIC = { id: 'basic', label: 'Basico', open: true };
const CAT_APPEARANCE = { id: 'appearance', label: 'Aparencia', open: false };
const CAT_TYPE = { id: 'type-config', label: 'Configuracao do tipo', open: true };
const CAT_LAYOUT = { id: 'layout', label: 'Layout', open: false };
const CAT_ADVANCED = { id: 'advanced', label: 'Avancado', open: false };

interface TraitDef {
  type: string;
  name: string;
  label: string;
  changeProp?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: Array<{ id: string; name: string }>;
  category?: { id: string; label: string; open?: boolean };
}

function registerType(
  editor: Editor,
  typeName: string,
  fieldType: string,
  displayName: string,
  extraTraits: TraitDef[],
) {
  // Adicionar categoria CAT_TYPE aos traits extras que nao tem categoria
  const typedExtraTraits = extraTraits.map(t => ({
    ...t,
    category: t.category || CAT_TYPE,
  }));

  editor.DomComponents.addType(typeName, {
    extend: 'crm-field',
    model: {
      defaults: {
        name: displayName,
        fieldType,
        traits: [
          // Herda os traits comuns do crm-field (com categorias)
          ...getBaseTraits(),
          // Adiciona traits especificos do tipo
          ...typedExtraTraits,
          // Trait de condicional (comum a todos, mas na categoria avancado)
          { type: 'textarea', name: 'fieldVisibleIf', label: 'Visivel se (JSON)', changeProp: true, category: CAT_ADVANCED },
          { type: 'textarea', name: 'fieldRequiredIf', label: 'Obrigatorio se (JSON)', changeProp: true, category: CAT_ADVANCED },
          { type: 'textarea', name: 'fieldOnChangeAutoFill', label: 'Ao mudar, preencher (JSON)', changeProp: true, category: CAT_ADVANCED },
        ],
      },
    },
  });
}

function getBaseTraits(): TraitDef[] {
  return [
    { type: 'text', name: 'fieldName', label: 'Slug', placeholder: 'nome_do_campo', changeProp: true, category: CAT_BASIC },
    { type: 'text', name: 'fieldLabel', label: 'Label', placeholder: 'Nome exibido', changeProp: true, category: CAT_BASIC },
    { type: 'checkbox', name: 'fieldRequired', label: 'Obrigatorio', changeProp: true, category: CAT_BASIC },
    { type: 'text', name: 'fieldPlaceholder', label: 'Placeholder', changeProp: true, category: CAT_APPEARANCE },
    { type: 'text', name: 'fieldHelpText', label: 'Texto de ajuda', changeProp: true, category: CAT_APPEARANCE },
    { type: 'text', name: 'fieldDefault', label: 'Valor padrao', changeProp: true, category: CAT_APPEARANCE },
    { type: 'checkbox', name: 'fieldHidden', label: 'Oculto', changeProp: true, category: CAT_ADVANCED },
    { type: 'checkbox', name: 'fieldUnique', label: 'Unico', changeProp: true, category: CAT_ADVANCED },
    // Layout
    {
      type: 'select', name: 'fieldColSpan', label: 'Largura', changeProp: true, category: CAT_LAYOUT,
      options: [
        { id: '1', name: '1/12' },
        { id: '2', name: '2/12' },
        { id: '3', name: '3/12 (1/4)' },
        { id: '4', name: '4/12 (1/3)' },
        { id: '5', name: '5/12' },
        { id: '6', name: '6/12 (1/2)' },
        { id: '7', name: '7/12' },
        { id: '8', name: '8/12 (2/3)' },
        { id: '9', name: '9/12 (3/4)' },
        { id: '10', name: '10/12' },
        { id: '11', name: '11/12' },
        { id: '12', name: '12/12 (Inteiro)' },
      ],
    },
  ];
}
