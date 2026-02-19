import { create } from 'zustand';
import { temporal } from 'zundo';
import type { PdfElement } from '@/types';

interface EditorState {
  // Elements
  elements: PdfElement[];
  selectedId: string | null;

  // Canvas settings
  zoom: number;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;

  // Page settings
  pageWidth: number;
  pageHeight: number;

  // Actions
  addElement: (element: PdfElement) => void;
  updateElement: (id: string, updates: Partial<PdfElement>) => void;
  removeElement: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  duplicateElement: (id: string) => void;
  moveElementUp: (id: string) => void;
  moveElementDown: (id: string) => void;

  // Canvas actions
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;

  // Bulk actions
  setElements: (elements: PdfElement[]) => void;
  clearElements: () => void;
}

// A4 dimensions in pixels (at 72 DPI)
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

export const usePdfEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      // Initial state
      elements: [],
      selectedId: null,
      zoom: 1,
      showGrid: true,
      snapToGrid: true,
      gridSize: 10,
      pageWidth: A4_WIDTH,
      pageHeight: A4_HEIGHT,

      // Element actions
      addElement: (element) =>
        set((state) => ({
          elements: [...state.elements, element],
          selectedId: element.name,
        })),

      updateElement: (id, updates) =>
        set((state) => ({
          elements: state.elements.map((el) =>
            el.name === id ? { ...el, ...updates } : el
          ),
        })),

      removeElement: (id) =>
        set((state) => ({
          elements: state.elements.filter((el) => el.name !== id),
          selectedId: state.selectedId === id ? null : state.selectedId,
        })),

      setSelectedId: (id) => set({ selectedId: id }),

      duplicateElement: (id) => {
        const state = get();
        const element = state.elements.find((el) => el.name === id);
        if (!element) return;

        const newElement: PdfElement = {
          ...element,
          name: `${element.name}_copy_${Date.now()}`,
          position: {
            x: element.position.x + 20,
            y: element.position.y + 20,
          },
        };

        set((state) => ({
          elements: [...state.elements, newElement],
          selectedId: newElement.name,
        }));
      },

      moveElementUp: (id) =>
        set((state) => {
          const index = state.elements.findIndex((el) => el.name === id);
          if (index <= 0) return state;

          const newElements = [...state.elements];
          [newElements[index - 1], newElements[index]] = [newElements[index], newElements[index - 1]];
          return { elements: newElements };
        }),

      moveElementDown: (id) =>
        set((state) => {
          const index = state.elements.findIndex((el) => el.name === id);
          if (index === -1 || index >= state.elements.length - 1) return state;

          const newElements = [...state.elements];
          [newElements[index], newElements[index + 1]] = [newElements[index + 1], newElements[index]];
          return { elements: newElements };
        }),

      // Canvas actions
      setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(2, zoom)) }),
      toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
      toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

      // Bulk actions
      setElements: (elements) => set({ elements, selectedId: null }),
      clearElements: () => set({ elements: [], selectedId: null }),
    }),
    {
      // Zundo options - limit history
      limit: 50,
      // Only track element changes for undo/redo
      partialize: (state) => ({
        elements: state.elements,
      }),
    }
  )
);

// Helper to snap value to grid
export function snapToGrid(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled) return value;
  return Math.round(value / gridSize) * gridSize;
}

// Helper to generate unique element ID
export function generateElementId(type: string): string {
  return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Default element templates
export const defaultElements: Record<string, Partial<PdfElement>> = {
  text: {
    type: 'text',
    width: 150,
    height: 24,
    fontSize: 12,
    fontColor: '#000000',
    fontWeight: 'normal',
    alignment: 'left',
  },
  image: {
    type: 'image',
    width: 100,
    height: 100,
  },
  rectangle: {
    type: 'rectangle',
    width: 100,
    height: 60,
    backgroundColor: 'transparent',
    borderColor: '#000000',
    borderWidth: 1,
  },
  line: {
    type: 'line',
    width: 100,
    height: 2,
    borderColor: '#000000',
    borderWidth: 1,
  },
  table: {
    type: 'table',
    width: 400,
    height: 150,
    fontSize: 10,
    fontColor: '#000000',
  },
  qrcode: {
    type: 'qrcode',
    width: 80,
    height: 80,
  },
  barcode: {
    type: 'barcode',
    width: 150,
    height: 50,
  },
};
