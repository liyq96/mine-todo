import { useEffect, useMemo, useState } from 'react';
import { emptyDraft, fromTodo, readError, sortTodos } from '../lib/todos';
import { backend } from '../lib/wails';
import type { BootstrapResponse, AppConfig, Todo, TodoDraft, TodoGroup } from '../types';

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
  const [groups, setGroups] = useState<TodoGroup[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
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
    setGroups(data.groups);
    setTodos(data.todos);

    const first = data.todos[0] ?? null;
    if (!first) {
      setSelectedId(null);
      setActiveGroupId(data.groups[0]?.id ?? null);
      setDraft(emptyDraft());
      setIsEditing(false);
      return;
    }

    const active = data.todos.find((item) => item.id === selectedId) ?? first;
    setSelectedId(active.id);
    setActiveGroupId(active.groupId);
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
    setActiveGroupId(todo.groupId);
    setDraft(fromTodo(todo));
    setIsEditing(false);
    setError('');
  }

  function selectGroup(groupID: string) {
    setActiveGroupId(groupID);
  }

  async function handleCreateTodo(title?: string, fallbackTitle?: string) {
    const baseTitle = fallbackTitle ?? 'New Todo';
    const nextTitle = (title ?? baseTitle).trim() || baseTitle;
    const nextGroupID = activeGroupId ?? groups[0]?.id ?? '';

    try {
      setSaving(true);
      const created = await backend.createTodo({
        groupId: nextGroupID,
        title: nextTitle,
        summary: '',
        detailMarkdown: '',
      });
      const nextTodos = sortTodos([created, ...todos]);
      setTodos(nextTodos);
      setSelectedId(created.id);
      setActiveGroupId(created.groupId);
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

  async function handleCreateGroup(name: string) {
    try {
      setSaving(true);
      const created = await backend.createGroup({ name });
      setGroups((current) => [...current, created]);
      setActiveGroupId(created.id);
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameGroup(id: string, name: string) {
    try {
      setSaving(true);
      const updated = await backend.updateGroup({ id, name });
      setGroups((current) => current.map((group) => (group.id === updated.id ? updated : group)));
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup(id: string, deleteTodos: boolean) {
    try {
      setSaving(true);
      const data = await backend.deleteGroup({ id, deleteTodos });
      applyBootstrap(data);
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
      setSaving(true);
      const updated = await backend.toggleCompleted(todo.id);
      syncUpdatedTodo(updated, true);
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      setSaving(false);
    }
  }

  return {
    config,
    groups,
    todos,
    selectedId,
    activeGroupId,
    draft,
    loading,
    quickTitle,
    isEditing,
    isDeleteConfirmOpen,
    selectedTodo,
    setGroups,
    setDraft,
    setQuickTitle,
    setIsEditing,
    setIsDeleteConfirmOpen,
    applyBootstrap,
    syncUpdatedTodo,
    selectTodo,
    selectGroup,
    handleCreateGroup,
    handleRenameGroup,
    handleDeleteGroup,
    handleCreateTodo,
    handleDeleteTodo,
    handleToggleCompleted,
  };
}
