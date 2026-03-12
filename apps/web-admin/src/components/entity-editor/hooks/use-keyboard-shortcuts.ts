import { useEffect } from 'react';
import { useEditorStore } from '../store/editor-store';

interface KeyboardShortcutsOptions {
  onSave: () => void;
}

export function useKeyboardShortcuts({ onSave }: KeyboardShortcutsOptions) {
  const selectedFieldId = useEditorStore(s => s.selectedFieldId);
  const duplicateField = useEditorStore(s => s.duplicateField);
  const removeField = useEditorStore(s => s.removeField);
  const selectField = useEditorStore(s => s.selectField);
  const pendingField = useEditorStore(s => s.pendingField);
  const setPendingField = useEditorStore(s => s.setPendingField);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement).isContentEditable) return;

      // Ctrl+S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave();
        return;
      }

      // Ctrl+D - Duplicate selected field
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (selectedFieldId) {
          duplicateField(selectedFieldId);
        }
        return;
      }

      // Ctrl+Z - Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        useEditorStore.temporal.getState().undo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y - Redo
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault();
        useEditorStore.temporal.getState().redo();
        return;
      }

      // Delete or Backspace - Remove selected field
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedFieldId) {
          removeField(selectedFieldId);
        }
        return;
      }

      // Escape - Deselect or cancel placement mode
      if (e.key === 'Escape') {
        if (pendingField) {
          setPendingField(null);
        } else if (selectedFieldId) {
          selectField(null);
        }
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedFieldId, duplicateField, removeField, selectField, pendingField, setPendingField, onSave]);
}
