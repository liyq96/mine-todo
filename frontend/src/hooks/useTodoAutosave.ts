import { useEffect, useMemo, useRef, useState } from 'react';
import { backend } from '../lib/wails';
import { fromTodo, persistableDraft, readError } from '../lib/todos';
import type { SaveStatus } from '../appTypes';
import type { Todo, TodoDraft } from '../types';

type UseTodoAutosaveArgs = {
  selectedId: string | null;
  selectedTodo: Todo | null;
  draft: TodoDraft;
  isEditing: boolean;
  setSaving: (value: boolean) => void;
  setError: (value: string) => void;
  unknownErrorText: string;
  syncUpdatedTodo: (todo: Todo, preserveEditingFields?: boolean) => void;
};

export function useTodoAutosave({
  selectedId,
  selectedTodo,
  draft,
  isEditing,
  setSaving,
  setError,
  unknownErrorText,
  syncUpdatedTodo,
}: UseTodoAutosaveArgs) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const autosaveTokenRef = useRef(0);

  const draftSignature = useMemo(() => JSON.stringify(persistableDraft(draft)), [draft]);
  const selectedSignature = useMemo(
    () => (selectedTodo ? JSON.stringify(persistableDraft(fromTodo(selectedTodo))) : ''),
    [selectedTodo],
  );

  useEffect(() => {
    if (!isEditing || !selectedTodo) {
      setSaveStatus('saved');
      return;
    }

    if (draftSignature === selectedSignature) {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('typing');
    const token = autosaveTokenRef.current + 1;
    autosaveTokenRef.current = token;

    const timer = window.setTimeout(() => {
      void persistDraft(token);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [draftSignature, isEditing, selectedSignature, selectedTodo]);

  async function persistDraft(token?: number) {
    if (!selectedId) {
      return;
    }

    if (token !== undefined && token !== autosaveTokenRef.current) {
      return;
    }

    try {
      setSaving(true);
      setSaveStatus('saving');
      const updated = await backend.updateTodo({
        id: selectedId,
        ...draft,
      });
      if (token !== undefined && token !== autosaveTokenRef.current) {
        return;
      }
      syncUpdatedTodo(updated);
      setSaveStatus('saved');
      setError('');
    } catch (err) {
      setSaveStatus('failed');
      setError(readError(err, unknownErrorText));
    } finally {
      setSaving(false);
    }
  }

  return {
    saveStatus,
    setSaveStatus,
  };
}
