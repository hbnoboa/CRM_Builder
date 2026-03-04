import type { Editor } from 'grapesjs';

/**
 * Registra trait types customizados no GrapeJS.
 * Cada trait cria um container DOM onde o React portal sera montado.
 */
export function registerCustomTraits(editor: Editor) {
  // ─── Trait: crm-options-editor ─────────────────────────────────────
  // Usado por: select, multiselect, radio-group, checkbox-group, tags
  registerPortalTrait(editor, 'crm-options-editor', 'fieldOptions');

  // ─── Trait: crm-entity-select ──────────────────────────────────────
  // Usado por: relation, sub-entity, lookup
  registerPortalTrait(editor, 'crm-entity-select', 'fieldRelatedEntityId');

  // ─── Trait: crm-workflow-editor ────────────────────────────────────
  // Usado por: workflow-status
  registerPortalTrait(editor, 'crm-workflow-editor', 'fieldWorkflowConfig');
}

/**
 * Registra um trait type que cria um container DOM para React portal.
 * O container recebe atributos data-* para o React saber qual editor montar.
 */
function registerPortalTrait(editor: Editor, traitType: string, defaultPropName: string) {
  editor.TraitManager.addType(traitType, {
    createInput({ trait }) {
      const container = document.createElement('div');
      container.setAttribute('data-trait-portal', traitType);
      // Use the trait's actual name (from field-types.ts definition), fallback to default
      container.setAttribute('data-trait-prop', trait.get('name') || defaultPropName);
      container.setAttribute('data-trait-id', trait.cid);
      container.className = 'crm-trait-portal';

      // Forcar um tamanho minimo
      container.style.minHeight = '40px';
      container.style.width = '100%';

      return container;
    },
    onEvent({ component, trait }) {
      // Disparar evento customizado para o React atualizar
      const el = trait.getInputEl();
      if (el) {
        el.dispatchEvent(new CustomEvent('trait-update', {
          detail: { component, trait },
        }));
      }
    },
  });
}

/**
 * Lista de todos os trait portal types registrados.
 * Usado pelo React para saber quais containers observar.
 */
export const PORTAL_TRAIT_TYPES = [
  'crm-options-editor',
  'crm-entity-select',
  'crm-workflow-editor',
] as const;

export type PortalTraitType = typeof PORTAL_TRAIT_TYPES[number];
