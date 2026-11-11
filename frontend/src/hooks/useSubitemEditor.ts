import { useMemo, useRef, useState } from 'react';
import { backend } from '../lib/wails';
import { createPendingSubitem, readError } from '../lib/todos';
import type { PendingSubitem } from '../appTypes';
import type { Todo, TodoDraft, TodoSubitem } from '../types';

type UseSubitemEditorArgs = {
  selectedId: string | null;
  draft: TodoDraft;
  selectedTodo: Todo | null;
  isEditing: boolean;
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
  setSaving,
  setError,
  unknownErrorText,
  syncUpdatedTodo,
}: UseSubitemEditorArgs) {
  const [pendingSubitems, setPendingSubitems] = useState<PendingSubitem[]>([]);
  const [editingSubitemId, setEditingSubitemId] = useState<string | null>(null);
  const [editingSubitemContent, setEditingSubitemContent] = useState('');
  const committingSubitemsRef = useRef(new Map<string, Promise<boolean>>());
  const editingWriteRef = useRef<Promise<boolean> | null>(null);
  const deletingSubitemsRef = useRef(new Set<string>());
  const latest = useRef({ selectedId, pendingSubitems, editingSubitemId, editingSubitemContent, draft });
  latest.current = { selectedId, pendingSubitems, editingSubitemId, editingSubitemContent, draft };

  const visibleSubitems = useMemo(
    () => (isEditing ? draft.subitems : selectedTodo?.subitems ?? []),
    [draft.subitems, isEditing, selectedTodo?.subitems],
  );

  function clearSubitemEditingState() {
    setPendingSubitems([]);
    setEditingSubitemId(null);
    setEditingSubitemContent('');
  }

  function handleAddSubitemInput() {
    setPendingSubitems((current) => current.some((item) => !item.content.trim()) ? current : [...current, createPendingSubitem()]);
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

  function commitPendingSubitem(id: string): Promise<boolean> {
    const pending = committingSubitemsRef.current.get(id);
    if (pending) return pending;
    const current = latest.current;
    const target = current.pendingSubitems.find((item) => item.id === id);
    if (!target || !current.selectedId) return Promise.resolve(true);
    const content = target.content.trim();
    if (!content) { removePendingSubitem(id); return Promise.resolve(true); }
    const todoId = current.selectedId;
    removePendingSubitem(id);
    setSaving(true);
    const task = (async () => {
      try {
        const updated = await backend.createSubitem({ todoId, content });
        syncUpdatedTodo(updated, true);
        setError('');
        return true;
      } catch (error) {
        if (latest.current.selectedId === todoId) setPendingSubitems((items) => [...items.filter((item) => item.id !== id), target]);
        setError(readError(error, unknownErrorText));
        return false;
      } finally {
        committingSubitemsRef.current.delete(id);
        setSaving(false);
      }
    })();
    committingSubitemsRef.current.set(id, task);
    return task;
  }

  function commitEditingSubitem(): Promise<boolean> {
    if (editingWriteRef.current) return editingWriteRef.current;
    const current = latest.current;
    if (!current.selectedId || !current.editingSubitemId) return Promise.resolve(true);
    const original = current.draft.subitems.find((item) => item.id === current.editingSubitemId);
    const content = current.editingSubitemContent.trim();
    if (!original || !content || content === original.content) {
      cancelEditingSubitem();
      return Promise.resolve(true);
    }
    const todoId = current.selectedId;
    const id = current.editingSubitemId;
    setSaving(true);
    const task = (async () => {
      try {
        const updated = await backend.updateSubitem({ todoId, id, content });
        if (latest.current.editingSubitemId === id && latest.current.editingSubitemContent.trim() === content) cancelEditingSubitem();
        syncUpdatedTodo(updated, true);
        setError('');
        return true;
      } catch (error) {
        setError(readError(error, unknownErrorText));
        return false;
      } finally {
        editingWriteRef.current = null;
        setSaving(false);
      }
    })();
    editingWriteRef.current = task;
    return task;
  }

  async function flushSubitems() {
    if ((await Promise.all(committingSubitemsRef.current.values())).some((saved) => !saved)) return false;
    if (!(await commitEditingSubitem())) return false;
    for (const item of latest.current.pendingSubitems) {
      if (!(await commitPendingSubitem(item.id))) return false;
    }
    return true;
  }

  async function handleDeleteSubitem(id: string) {
    if (!selectedId || deletingSubitemsRef.current.has(id)) return;
    const todoId = selectedId;
    deletingSubitemsRef.current.add(id);
    setSaving(true);
    try {
      // A keyboard focus change may already have started saving this row.
      if (editingWriteRef.current) await editingWriteRef.current;
      const updated = await backend.deleteSubitems({
        todoId,
        ids: [id],
      });
      if (latest.current.selectedId === todoId && latest.current.editingSubitemId === id) cancelEditingSubitem();
      syncUpdatedTodo(updated, true);
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      deletingSubitemsRef.current.delete(id);
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
    flushSubitems,
    visibleSubitems,
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
    handleDeleteSubitem,
    handleToggleSubitemCompleted,
  };
}
