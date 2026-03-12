import { create } from 'zustand';
import { temporal } from 'zundo';
import type { EntityField, EntitySettings } from '@crm-builder/shared';
import type { Layout } from 'react-grid-layout';

// Field types that need 2 rows of height (h=2 → 106px with rowHeight=50 + margin=6)
const TALL_TYPES = new Set([
  'textarea', 'richtext', 'map', 'zone-diagram',
  'checkbox-group', 'radio-group', 'tags', 'array',
]);

export function getFieldHeight(type: string): number {
  return TALL_TYPES.has(type) ? 2 : 1;
}

export function fieldsToLayout(fields: EntityField[]): Layout[] {
  return fields.map((f, i) => ({
    i: f.slug,
    x: (f.gridColStart ?? 1) - 1,
    y: f.gridRow ?? i,
    w: f.gridColSpan ?? 12,
    h: f.gridRowSpan ?? getFieldHeight(f.type),
    minW: 2,
    maxW: 12,
    minH: 1,
    maxH: 4,
  }));
}

function generateSlug(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function ensureUniqueSlug(slug: string, existing: string[]): string {
  if (!existing.includes(slug)) return slug;
  let i = 2;
  while (existing.includes(`${slug}_${i}`)) i++;
  return `${slug}_${i}`;
}

interface EditorState {
  // Data
  fields: EntityField[];
  entityName: string;
  entityDescription: string;
  entitySettings: EntitySettings;

  // UI state
  selectedFieldId: string | null;
  pendingField: { type: string; label: string } | null;

  // Actions
  initialize: (fields: EntityField[], name: string, description: string, settings: EntitySettings) => void;
  addField: (type: string, label: string, atRow?: number) => void;
  removeField: (slug: string) => void;
  updateField: (slug: string, updates: Partial<EntityField>) => void;
  duplicateField: (slug: string) => void;
  selectField: (slug: string | null) => void;
  updateLayout: (layout: Layout[]) => void;
  clearAll: () => void;
  setPendingField: (pending: { type: string; label: string } | null) => void;
  setEntityName: (name: string) => void;
  setEntityDescription: (desc: string) => void;
  setEntitySettings: (settings: EntitySettings) => void;
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      fields: [],
      entityName: '',
      entityDescription: '',
      entitySettings: {},
      selectedFieldId: null,
      pendingField: null,

      initialize: (fields, name, description, settings) => {
        // Sort by original gridRow to preserve order, then reassign sequential rows
        const sorted = [...fields].sort((a, b) => (a.gridRow ?? 0) - (b.gridRow ?? 0));
        let nextRow = 0;
        const normalized = sorted.map((f) => {
          const h = getFieldHeight(f.type);
          const row = nextRow;
          nextRow += h;
          return {
            ...f,
            gridRow: row,
            gridColSpan: f.gridColSpan ?? 12,
            gridColStart: f.gridColStart ?? 1,
            gridRowSpan: h,
          };
        });
        set({
          fields: normalized,
          entityName: name,
          entityDescription: description,
          entitySettings: settings || {},
          selectedFieldId: null,
          pendingField: null,
        });
      },

      addField: (type, label, atRow) => {
        const state = get();
        const existingSlugs = state.fields.map(f => f.slug);
        const baseSlug = generateSlug(label);
        const slug = ensureUniqueSlug(baseSlug, existingSlugs);

        // Calculate row position
        const maxRow = state.fields.length > 0
          ? Math.max(...state.fields.map(f => f.gridRow ?? 0))
          : -1;
        const row = atRow ?? maxRow + 1;

        const newField: EntityField = {
          slug,
          name: label,
          label,
          type: type as EntityField['type'],
          gridRow: row,
          gridColStart: 1,
          gridColSpan: 12,
          gridRowSpan: getFieldHeight(type),
        };

        set({
          fields: [...state.fields, newField],
          selectedFieldId: slug,
          pendingField: null,
        });
      },

      removeField: (slug) => {
        set(state => ({
          fields: state.fields.filter(f => f.slug !== slug),
          selectedFieldId: state.selectedFieldId === slug ? null : state.selectedFieldId,
        }));
      },

      updateField: (slug, updates) => {
        set(state => ({
          fields: state.fields.map(f =>
            f.slug === slug ? { ...f, ...updates } : f
          ),
        }));
      },

      duplicateField: (slug) => {
        const state = get();
        const source = state.fields.find(f => f.slug === slug);
        if (!source) return;

        const existingSlugs = state.fields.map(f => f.slug);
        const newSlug = ensureUniqueSlug(`${source.slug}_copy`, existingSlugs);

        const duplicate: EntityField = {
          ...source,
          slug: newSlug,
          name: `${source.name} (copia)`,
          label: `${source.label || source.name} (copia)`,
          gridRow: (source.gridRow ?? 0) + 1,
        };

        // Insert after source
        const sourceIndex = state.fields.findIndex(f => f.slug === slug);
        const newFields = [...state.fields];
        newFields.splice(sourceIndex + 1, 0, duplicate);

        set({
          fields: newFields,
          selectedFieldId: newSlug,
        });
      },

      selectField: (slug) => {
        set({ selectedFieldId: slug });
      },

      updateLayout: (layout) => {
        set(state => ({
          fields: state.fields.map(field => {
            const item = layout.find(l => l.i === field.slug);
            if (!item) return field;
            return {
              ...field,
              gridRow: item.y,
              gridColStart: item.x + 1,
              gridColSpan: item.w,
              gridRowSpan: item.h,
            };
          }),
        }));
      },

      clearAll: () => {
        set({ fields: [], selectedFieldId: null });
      },

      setPendingField: (pending) => {
        set({ pendingField: pending });
      },

      setEntityName: (name) => {
        set({ entityName: name });
      },

      setEntityDescription: (desc) => {
        set({ entityDescription: desc });
      },

      setEntitySettings: (settings) => {
        set({ entitySettings: settings });
      },
    }),
    {
      limit: 50,
      equality: (a, b) => JSON.stringify(a.fields) === JSON.stringify(b.fields),
    },
  ),
);
