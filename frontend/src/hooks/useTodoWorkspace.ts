import { useEffect, useMemo, useState } from 'react';
import { emptyDraft, fromTodo, readError, sortTodos } from '../lib/todos';
import { backend } from '../lib/wails';
import type { BootstrapResponse, AppConfig, Todo, TodoDraft } from '../types';

type UseTodoWorkspaceArgs = {
  unknownErrorText: string;
  setSaving: (value: boolean) => void;
  setError: (value: string) => void;
};

export function useTodoWorkspace({
  unknownErrorText,
  setSaving,
  setError,
}: UseTodoWorkspaceArgs) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TodoDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [quickTitle, setQuickTitle] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const selectedTodo = useMemo(
    () => todos.find((item) => item.id === selectedId) ?? null,
    [selectedId, todos],
  );

  useEffect(() => {
    void loadBootstrap();
  }, []);

  async function loadBootstrap() {
    try {
      setLoading(true);
      const data = await backend.getBootstrap();
      applyBootstrap(data);
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      setLoading(false);
    }
  }

  function applyBootstrap(data: BootstrapResponse) {
    setConfig(data.config);
    setTodos(data.todos);

    const first = data.todos[0] ?? null;
    if (!first) {
      setSelectedId(null);
      setDraft(emptyDraft());
      setIsEditing(false);
      return;
    }

    const active = data.todos.find((item) => item.id === selectedId) ?? first;
    setSelectedId(active.id);
    setDraft(fromTodo(active));
  }

  function syncUpdatedTodo(updated: Todo, preserveEditingFields = false) {
    setTodos((current) => sortTodos(current.map((item) => (item.id === updated.id ? updated : item))));

    if (selectedId !== updated.id) {
      return;
    }

    if (preserveEditingFields && isEditing) {
      setDraft((current) => ({
        ...current,
        subitems: updated.subitems,
      }));
      return;
    }

    setDraft(fromTodo(updated));
  }

  function selectTodo(todo: Todo) {
    setSelectedId(todo.id);
    setDraft(fromTodo(todo));
    setIsEditing(false);
    setError('');
  }

  async function handleCreateTodo(title?: string, fallbackTitle?: string) {
    const baseTitle = fallbackTitle ?? 'New Todo';
    const nextTitle = (title ?? baseTitle).trim() || baseTitle;

    try {
      setSaving(true);
      const created = await backend.createTodo({
        title: nextTitle,
        summary: '',
        detailMarkdown: '',
      });
      const nextTodos = sortTodos([created, ...todos]);
      setTodos(nextTodos);
      setSelectedId(created.id);
      setDraft(fromTodo(created));
      setQuickTitle('');
      setIsEditing(true);
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTodo() {
    if (!selectedId) {
      return;
    }

    try {
      setSaving(true);
      await backend.deleteTodo(selectedId);
      const nextTodos = todos.filter((item) => item.id !== selectedId);
      setTodos(nextTodos);
      const next = nextTodos[0] ?? null;
      setSelectedId(next?.id ?? null);
      setDraft(next ? fromTodo(next) : emptyDraft());
      setIsEditing(false);
      setIsDeleteConfirmOpen(false);
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleCompleted(todo: Todo) {
    try {
      const updated = await backend.toggleCompleted(todo.id);
      syncUpdatedTodo(updated, true);
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    }
  }

  return {
    config,
    todos,
    selectedId,
    draft,
    loading,
    quickTitle,
    isEditing,
    isDeleteConfirmOpen,
    selectedTodo,
    setDraft,
    setQuickTitle,
    setIsEditing,
    setIsDeleteConfirmOpen,
    applyBootstrap,
    syncUpdatedTodo,
    selectTodo,
    handleCreateTodo,
    handleDeleteTodo,
    handleToggleCompleted,
  };
}
