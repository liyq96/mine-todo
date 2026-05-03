import type { Dispatch, SetStateAction } from 'react';
import { useMemo, useState } from 'react';
import { backend } from '../lib/wails';
import { createPendingSubitem, readError } from '../lib/todos';
import type { PendingSubitem } from '../appTypes';
import type { Todo, TodoDraft, TodoSubitem } from '../types';

type UseSubitemEditorArgs = {
  selectedId: string | null;
  draft: TodoDraft;
  selectedTodo: Todo | null;
  isEditing: boolean;
  setDraft: Dispatch<SetStateAction<TodoDraft>>;
  setSaving: (value: boolean) => void;
  setError: (value: string) => void;
  unknownErrorText: string;
  syncUpdatedTodo: (todo: Todo, preserveEditingFields?: boolean) => void;
};

export function useSubitemEditor({
  selectedId,
  draft,
  selectedTodo,
  isEditing,
  setDraft,
  setSaving,
  setError,
  unknownErrorText,
  syncUpdatedTodo,
}: UseSubitemEditorArgs) {
  const [selectedSubitemIds, setSelectedSubitemIds] = useState<string[]>([]);
  const [pendingSubitems, setPendingSubitems] = useState<PendingSubitem[]>([]);
  const [editingSubitemId, setEditingSubitemId] = useState<string | null>(null);
  const [editingSubitemContent, setEditingSubitemContent] = useState('');

  const visibleSubitems = useMemo(
    () => (isEditing ? draft.subitems : selectedTodo?.subitems ?? []),
    [draft.subitems, isEditing, selectedTodo?.subitems],
  );

  function clearSubitemEditingState() {
    setSelectedSubitemIds([]);
    setPendingSubitems([]);
    setEditingSubitemId(null);
    setEditingSubitemContent('');
  }

  function handleAddSubitemInput() {
    setPendingSubitems((current) => [...current, createPendingSubitem()]);
  }

  function handlePendingSubitemChange(id: string, content: string) {
    setPendingSubitems((current) =>
      current.map((item) => (item.id === id ? { ...item, content } : item)),
    );
  }

  function removePendingSubitem(id: string) {
    setPendingSubitems((current) => current.filter((item) => item.id !== id));
  }

  function startEditingSubitem(subitem: TodoSubitem) {
    setEditingSubitemId(subitem.id);
    setEditingSubitemContent(subitem.content);
  }

  function cancelEditingSubitem() {
    setEditingSubitemId(null);
    setEditingSubitemContent('');
  }

  async function commitPendingSubitem(id: string) {
    const target = pendingSubitems.find((item) => item.id === id);
    if (!target || !selectedId) {
      return;
    }

    const content = target.content.trim();
    if (!content) {
      removePendingSubitem(id);
      return;
    }

    removePendingSubitem(id);

    try {
      setSaving(true);
      const updated = await backend.createSubitem({
        todoId: selectedId,
        content,
      });
      syncUpdatedTodo(updated, true);
      setError('');
    } catch (err) {
      setPendingSubitems((current) => [...current, target]);
      setError(readError(err, unknownErrorText));
    } finally {
      setSaving(false);
    }
  }

  async function commitEditingSubitem() {
    if (!selectedId || !editingSubitemId) {
      return;
    }

    const original = draft.subitems.find((item) => item.id === editingSubitemId);
    if (!original) {
      cancelEditingSubitem();
      return;
    }

    const content = editingSubitemContent.trim();
    if (!content || content === original.content) {
      cancelEditingSubitem();
      return;
    }

    try {
      setSaving(true);
      const updated = await backend.updateSubitem({
        todoId: selectedId,
        id: editingSubitemId,
        content,
      });
      cancelEditingSubitem();
      syncUpdatedTodo(updated, true);
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      setSaving(false);
    }
  }

  function toggleSubitemSelection(id: string) {
    setSelectedSubitemIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function handleDeleteSelectedSubitems() {
    if (!selectedId || selectedSubitemIds.length === 0) {
      return;
    }

    try {
      setSaving(true);
      const updated = await backend.deleteSubitems({
        todoId: selectedId,
        ids: selectedSubitemIds,
      });
      setSelectedSubitemIds([]);
      syncUpdatedTodo(updated, true);
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSubitemCompleted(subitem: TodoSubitem) {
    if (!selectedId) {
      return;
    }

    try {
      setSaving(true);
      const updated = await backend.toggleSubitemCompleted({
        todoId: selectedId,
        id: subitem.id,
      });
      syncUpdatedTodo(updated, true);
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      setSaving(false);
    }
  }

  return {
    visibleSubitems,
    selectedSubitemIds,
    pendingSubitems,
    editingSubitemId,
    editingSubitemContent,
    setEditingSubitemContent,
    clearSubitemEditingState,
    handleAddSubitemInput,
    handlePendingSubitemChange,
    removePendingSubitem,
    startEditingSubitem,
    cancelEditingSubitem,
    commitPendingSubitem,
    commitEditingSubitem,
    toggleSubitemSelection,
    handleDeleteSelectedSubitems,
    handleToggleSubitemCompleted,
  };
}
