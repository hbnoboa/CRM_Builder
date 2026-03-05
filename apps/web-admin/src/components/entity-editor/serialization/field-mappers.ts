import type { EntityField } from '@crm-builder/shared';

/**
 * Mapeia propriedades de EntityField para propriedades de componente GrapeJS.
 * O prefixo `field` e adicionado para evitar conflito com propriedades nativas do GrapeJS.
 */

// Propriedades simples que sao copiadas diretamente (com prefixo `field`)
const SIMPLE_PROPS: Array<{
  entityKey: keyof EntityField;
  gjsKey: string;
  type: 'string' | 'boolean' | 'number';
}> = [
  { entityKey: 'name', gjsKey: 'fieldName', type: 'string' },
  { entityKey: 'label', gjsKey: 'fieldLabel', type: 'string' },
  { entityKey: 'required', gjsKey: 'fieldRequired', type: 'boolean' },
  { entityKey: 'placeholder', gjsKey: 'fieldPlaceholder', type: 'string' },
  { entityKey: 'helpText', gjsKey: 'fieldHelpText', type: 'string' },
  { entityKey: 'hidden', gjsKey: 'fieldHidden', type: 'boolean' },
  { entityKey: 'disabled', gjsKey: 'fieldDisabled', type: 'boolean' },
  { entityKey: 'unique', gjsKey: 'fieldUnique', type: 'boolean' },
  // Number/currency
  { entityKey: 'min', gjsKey: 'fieldMin', type: 'number' },
  { entityKey: 'max', gjsKey: 'fieldMax', type: 'number' },
  { entityKey: 'step', gjsKey: 'fieldStep', type: 'number' },
  { entityKey: 'prefix', gjsKey: 'fieldPrefix', type: 'string' },
  { entityKey: 'suffix', gjsKey: 'fieldSuffix', type: 'string' },
  // Text
  { entityKey: 'mask', gjsKey: 'fieldMask', type: 'string' },
  // Map
  { entityKey: 'mapMode', gjsKey: 'fieldMapMode', type: 'string' },
  { entityKey: 'mapHeight', gjsKey: 'fieldMapHeight', type: 'number' },
  // Image/File
  { entityKey: 'multiple', gjsKey: 'fieldMultiple', type: 'boolean' },
  { entityKey: 'maxFiles', gjsKey: 'fieldMaxFiles', type: 'number' },
  { entityKey: 'imageSource', gjsKey: 'fieldImageSource', type: 'string' },
  // Relation
  { entityKey: 'relatedEntityId', gjsKey: 'fieldRelatedEntityId', type: 'string' },
  { entityKey: 'relatedEntitySlug', gjsKey: 'fieldRelatedEntitySlug', type: 'string' },
  { entityKey: 'relatedDisplayField', gjsKey: 'fieldRelatedDisplayField', type: 'string' },
  // Sub-entity
  { entityKey: 'subEntityId', gjsKey: 'fieldSubEntityId', type: 'string' },
  { entityKey: 'subEntitySlug', gjsKey: 'fieldSubEntitySlug', type: 'string' },
  { entityKey: 'parentDisplayField', gjsKey: 'fieldParentDisplayField', type: 'string' },
  // Api-select
  { entityKey: 'apiEndpoint', gjsKey: 'fieldApiEndpoint', type: 'string' },
  { entityKey: 'valueField', gjsKey: 'fieldValueField', type: 'string' },
  { entityKey: 'labelField', gjsKey: 'fieldLabelField', type: 'string' },
  // Zone diagram
  { entityKey: 'diagramSaveMode', gjsKey: 'fieldDiagramSaveMode', type: 'string' },
  { entityKey: 'diagramImage', gjsKey: 'fieldDiagramImage', type: 'string' },
  // Grid positioning
  { entityKey: 'gridRow', gjsKey: 'fieldGridRow', type: 'number' },
  { entityKey: 'gridColSpan', gjsKey: 'fieldGridColSpan', type: 'number' },
  { entityKey: 'gridColStart', gjsKey: 'fieldGridColStart', type: 'number' },
];

// Propriedades que sao serializadas como JSON string
const JSON_PROPS: Array<{
  entityKey: keyof EntityField;
  gjsKey: string;
}> = [
  { entityKey: 'options', gjsKey: 'fieldOptions' },
  { entityKey: 'subEntityDisplayFields', gjsKey: 'fieldSubEntityDisplayFields' },
  { entityKey: 'apiFields', gjsKey: 'fieldApiFields' },
  { entityKey: 'autoFillFields', gjsKey: 'fieldAutoFillFields' },
  { entityKey: 'onChangeAutoFill', gjsKey: 'fieldOnChangeAutoFill' },
  { entityKey: 'mapDefaultCenter', gjsKey: 'fieldMapDefaultCenter' },
  { entityKey: 'diagramZones', gjsKey: 'fieldDiagramZones' },
  // Configs complexos
  { entityKey: 'workflowConfig', gjsKey: 'fieldWorkflowConfig' },
  { entityKey: 'timerConfig', gjsKey: 'fieldTimerConfig' },
  { entityKey: 'slaConfig', gjsKey: 'fieldSlaConfig' },
  { entityKey: 'formulaConfig', gjsKey: 'fieldFormulaConfig' },
  { entityKey: 'rollupConfig', gjsKey: 'fieldRollupConfig' },
  { entityKey: 'lookupConfig', gjsKey: 'fieldLookupConfig' },
  { entityKey: 'actionButtonConfig', gjsKey: 'fieldActionButtonConfig' },
  { entityKey: 'userSelectConfig', gjsKey: 'fieldUserSelectConfig' },
  { entityKey: 'tagsConfig', gjsKey: 'fieldTagsConfig' },
  { entityKey: 'signatureConfig', gjsKey: 'fieldSignatureConfig' },
  { entityKey: 'checkboxGroupConfig', gjsKey: 'fieldCheckboxGroupConfig' },
  { entityKey: 'radioGroupConfig', gjsKey: 'fieldRadioGroupConfig' },
  // Validation/conditional
  { entityKey: 'validation', gjsKey: 'fieldValidation' },
  { entityKey: 'validators', gjsKey: 'fieldValidators' },
  { entityKey: 'visibleIf', gjsKey: 'fieldVisibleIf' },
  { entityKey: 'requiredIf', gjsKey: 'fieldRequiredIf' },
  { entityKey: 'readOnlyIf', gjsKey: 'fieldReadOnlyIf' },
  { entityKey: 'crossFieldValidation', gjsKey: 'fieldCrossFieldValidation' },
];

/**
 * Converte um EntityField para propriedades de componente GrapeJS.
 */
export function entityFieldToGjsProps(field: EntityField): Record<string, unknown> {
  const props: Record<string, unknown> = {
    fieldType: field.type,
  };

  // Valor default
  if (field.default !== undefined && field.default !== null) {
    props.fieldDefault = typeof field.default === 'object'
      ? JSON.stringify(field.default)
      : String(field.default);
  }

  // Propriedades simples
  for (const { entityKey, gjsKey, type } of SIMPLE_PROPS) {
    const value = field[entityKey];
    if (value !== undefined && value !== null) {
      if (type === 'number') {
        props[gjsKey] = Number(value) || 0;
      } else if (type === 'boolean') {
        props[gjsKey] = Boolean(value);
      } else {
        props[gjsKey] = String(value);
      }
    }
  }

  // Slug -> label fallback
  if (!props.fieldLabel && field.name) {
    props.fieldLabel = field.label || field.name;
  }

  // Propriedades JSON
  for (const { entityKey, gjsKey } of JSON_PROPS) {
    const value = field[entityKey];
    if (value !== undefined && value !== null) {
      try {
        props[gjsKey] = typeof value === 'string' ? value : JSON.stringify(value);
      } catch {
        props[gjsKey] = '';
      }
    }
  }

  return props;
}

/**
 * Converte propriedades de componente GrapeJS de volta para EntityField.
 */
export function gjsPropsToEntityField(
  props: Record<string, unknown>,
  order: number,
): EntityField {
  const field: Partial<EntityField> = {
    slug: String(props.fieldName || ''),
    name: String(props.fieldName || ''),
    label: String(props.fieldLabel || ''),
    type: String(props.fieldType || 'text') as EntityField['type'],
  };

  // Valor default
  if (props.fieldDefault !== undefined && props.fieldDefault !== '') {
    const defaultStr = String(props.fieldDefault);
    try {
      field.default = JSON.parse(defaultStr);
    } catch {
      field.default = defaultStr;
    }
  }

  // Propriedades simples
  for (const { entityKey, gjsKey, type } of SIMPLE_PROPS) {
    const value = props[gjsKey];
    if (value === undefined || value === null) continue;

    if (type === 'number') {
      const num = Number(value);
      if (!isNaN(num)) {
        (field as Record<string, unknown>)[entityKey] = num;
      }
    } else if (type === 'boolean') {
      if (value === true) {
        (field as Record<string, unknown>)[entityKey] = true;
      }
      // false booleans: GrapeJS omits them when they match default (false),
      // so if present and true, we set it. Otherwise skip (default is false).
    } else {
      const str = String(value);
      if (str !== '') {
        (field as Record<string, unknown>)[entityKey] = str;
      }
    }
  }

  // Propriedades JSON
  for (const { entityKey, gjsKey } of JSON_PROPS) {
    const value = props[gjsKey];
    if (value && typeof value === 'string' && value !== '[]' && value !== '{}' && value !== '') {
      try {
        (field as Record<string, unknown>)[entityKey] = JSON.parse(value);
      } catch {
        // Se nao e JSON valido, pode ser uma string simples — ignorar
      }
    }
  }

  // Booleans que podem ser false (importante para required, hidden, etc.)
  if (props.fieldRequired === true) field.required = true;
  if (props.fieldHidden === true) field.hidden = true;
  if (props.fieldDisabled === true) field.disabled = true;
  if (props.fieldUnique === true) field.unique = true;
  if (props.fieldMultiple === true) field.multiple = true;

  // Limpar propriedades undefined/null
  const cleanField: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(field)) {
    if (value !== undefined && value !== null) {
      cleanField[key] = value;
    }
  }

  return cleanField as EntityField;
}
