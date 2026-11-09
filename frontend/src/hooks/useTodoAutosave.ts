import { useRef } from 'react';
import { backend } from '../lib/wails';
import { fromTodo, persistableDraft } from '../lib/todos';
import { useDraftAutosave } from './useDraftAutosave';
import type { Todo, TodoDraft } from '../types';

type UseTodoAutosaveArgs = {
  databasePath: string;
  selectedId: string | null;
  selectedTodo: Todo | null;
  draft: TodoDraft;
  suspended: boolean;
  setSaving: (value: boolean) => void;
  setError: (value: string) => void;
  unknownErrorText: string;
  syncUpdatedTodo: (todo: Todo, preserveDraft?: boolean) => void;
  onSaved?: () => Promise<void>;
};

export function useTodoAutosave(args: UseTodoAutosaveArgs) {
  const { databasePath, selectedId, selectedTodo, draft } = args;
  const refreshNeeded = useRef(false);
  return useDraftAutosave({
    scope: databasePath && selectedId ? JSON.stringify([databasePath, selectedId]) : null,
    draft: persistableDraft(draft),
    savedDraft: selectedTodo ? persistableDraft(fromTodo(selectedTodo)) : null,
    delay: 700,
    suspended: args.suspended,
    save: (value) => backend.updateTodo({ id: selectedId!, databasePath, ...value }),
    fromResult: (todo: Todo) => persistableDraft(fromTodo(todo)),
    apply: (updated, preserveDraft) => {
      if (JSON.stringify(selectedTodo?.noteIds) !== JSON.stringify(updated.noteIds)) refreshNeeded.current = true;
      args.syncUpdatedTodo(updated, preserveDraft);
    },
    onSettled: async () => {
      if (refreshNeeded.current && args.onSaved) {
        await args.onSaved();
        refreshNeeded.current = false;
      }
    },
    setSaving: args.setSaving,
    setError: args.setError,
    errorText: args.unknownErrorText,
  });
}
