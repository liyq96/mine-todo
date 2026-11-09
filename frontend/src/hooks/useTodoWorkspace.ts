import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { emptyDraft, fromTodo, persistableDraft, readError, sortTodos } from '../lib/todos';
import { backend } from '../lib/wails';
import { useTodoAutosave } from './useTodoAutosave';
import type { BootstrapResponse, AppConfig, Note, Todo, TodoDraft, TodoGroup, TrashData } from '../types';

type UseTodoWorkspaceArgs = {
  unknownErrorText: string;
  setSaving: (value: boolean) => void;
  setError: (value: string) => void;
  suspended?: boolean;
};

export function useTodoWorkspace({
  unknownErrorText,
  setSaving,
  setError,
  suspended = false,
}: UseTodoWorkspaceArgs) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [groups, setGroups] = useState<TodoGroup[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [trash, setTrash] = useState<TrashData>({ groups: [], todos: [], notes: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TodoDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [quickTitle, setQuickTitle] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isCreatingTodo, setIsCreatingTodo] = useState(false);
  const [isDeletingTodo, setIsDeletingTodo] = useState(false);
  const [togglingTodoIds, setTogglingTodoIds] = useState<string[]>([]);
  const creatingTodoRef = useRef(false);
  const togglingTodoIdsRef = useRef(new Set<string>());
  const selectedIdRef = useRef(selectedId);
  const todosRef = useRef(todos);
  const bootstrapVersionRef = useRef(0);
  const deletingTodoIdRef = useRef<string | null>(null);
  const navigationRef = useRef(0);
  selectedIdRef.current = selectedId;
  todosRef.current = todos;

  const selectedTodo = useMemo(
    () => todos.find((item) => item.id === selectedId) ?? null,
    [selectedId, todos],
  );

  const { saveStatus, flush: flushCurrentTodo, markEdited } = useTodoAutosave({
    databasePath: config?.dbPath ?? '', selectedId, selectedTodo, draft,
    suspended: suspended || isDeleteConfirmOpen || isDeletingTodo,
    setSaving, setError, unknownErrorText, syncUpdatedTodo,
    onSaved: refreshBootstrap,
  });

  const changeDraft: Dispatch<SetStateAction<TodoDraft>> = (updater) => {
    markEdited();
    setDraft(updater);
  };

  useEffect(() => {
    void loadBootstrap();
  }, []);

  async function loadBootstrap() {
    const version = bootstrapVersionRef.current;
    try {
      setLoading(true);
      const data = await backend.getBootstrap();
      if (version !== bootstrapVersionRef.current) return;
      applyBootstrap(data);
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      setLoading(false);
    }
  }

  async function refreshBootstrap() {
    const version = bootstrapVersionRef.current;
    const data = await backend.getBootstrap();
    if (version !== bootstrapVersionRef.current) return;
    applyBootstrap(data, true);
  }

  function applyBootstrap(data: BootstrapResponse, preserveSelection = false) {
    bootstrapVersionRef.current += 1;
    const previous = todosRef.current.find((item) => item.id === selectedIdRef.current);
    setConfig(data.config);
    setGroups(data.groups);
    setTodos(data.todos);
    setNotes(data.notes);
    setTrash(data.trash);

    const first = data.todos[0] ?? null;
    if (!first) {
      selectedIdRef.current = null;
      setSelectedId(null);
      setActiveGroupId(data.groups[0]?.id ?? null);
      setDraft(emptyDraft());
      setIsEditing(false);
      return;
    }

    // A background refresh must not select another item after deletion.
    if (preserveSelection && !selectedIdRef.current) return;
    const active = data.todos.find((item) => item.id === selectedIdRef.current) ?? first;
    selectedIdRef.current = active.id;
    setSelectedId(active.id);
    setActiveGroupId(active.groupId);
    setDraft((current) => {
      if (preserveSelection && previous?.id === active.id
        && JSON.stringify(persistableDraft(current)) !== JSON.stringify(persistableDraft(fromTodo(previous)))) {
        return { ...current, isCompleted: active.isCompleted, subitems: active.subitems };
      }
      return fromTodo(active);
    });
  }

  function syncUpdatedTodo(updated: Todo, preserveEditingFields = false) {
    setTodos((current) => sortTodos(current.map((item) => (item.id === updated.id ? updated : item))));

    if (selectedIdRef.current !== updated.id || deletingTodoIdRef.current === updated.id) {
      return;
    }

    if (preserveEditingFields) {
      setDraft((current) => ({
        ...current,
        isCompleted: updated.isCompleted,
        subitems: updated.subitems,
      }));
      return;
    }

    setDraft(fromTodo(updated));
  }

  async function selectTodo(todo: Todo) {
    const navigation = ++navigationRef.current;
    if (!(await flushCurrentTodo()) || navigation !== navigationRef.current) return false;
    todo = todosRef.current.find((item) => item.id === todo.id) ?? todo;
    selectedIdRef.current = todo.id;
    setSelectedId(todo.id);
    setActiveGroupId(todo.groupId);
    setDraft(fromTodo(todo));
    setIsEditing(false);
    setError('');
    return true;
  }

  function selectGroup(groupID: string) {
    setActiveGroupId(groupID);
  }

  async function handleCreateTodo(title?: string, fallbackTitle?: string, groupID?: string) {
    // React state updates do not block another event in the same tick.
    if (creatingTodoRef.current) return;
    creatingTodoRef.current = true;
    setIsCreatingTodo(true);
    const baseTitle = fallbackTitle ?? 'New Todo';
    const nextTitle = (title ?? baseTitle).trim() || baseTitle;
    const nextGroupID = groupID ?? activeGroupId ?? groups[0]?.id ?? '';

    setSaving(true);
    try {
      if (!(await flushCurrentTodo())) return;
      const created = await backend.createTodo({
        groupId: nextGroupID,
        title: nextTitle,
        summary: '',
        detailMarkdown: '',
        dueDate: '',
        priority: 'q4',
        reminderAt: '',
        tags: [],
        noteIds: [],
        isFavorite: false,
        isArchived: false,
      });
      setTodos((current) => sortTodos([created, ...current]));
      setSelectedId(created.id);
      setActiveGroupId(created.groupId);
      setDraft(fromTodo(created));
      if (!groupID) setQuickTitle((current) => current.trim() === nextTitle ? '' : current);
      setIsEditing(true);
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      creatingTodoRef.current = false;
      setIsCreatingTodo(false);
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
    if (!(await flushCurrentTodo())) return false;
    try {
      setSaving(true);
      const data = await backend.deleteGroup({ id, deleteTodos });
      applyBootstrap(data);
      setError('');
      return true;
    } catch (err) {
      setError(readError(err, unknownErrorText));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTodo() {
    const id = selectedIdRef.current;
    if (!id || deletingTodoIdRef.current) {
      return false;
    }
    deletingTodoIdRef.current = id;
    bootstrapVersionRef.current += 1;
    setIsDeletingTodo(true);
    setSaving(true);
    try {
      if (!(await flushCurrentTodo())) return false;
      await backend.deleteTodo(id);
      bootstrapVersionRef.current += 1;
      setTodos((current) => current.filter((item) => item.id !== id));
      const deleted = todosRef.current.find((item) => item.id === id);
      if (deleted) {
        setTrash((current) => ({ ...current, todos: [...current.todos.filter((item) => item.id !== id), {
          ...deleted, isTrashed: true, trashedAt: new Date().toISOString(),
        }] }));
      }
      if (selectedIdRef.current === id) {
        selectedIdRef.current = null;
        setSelectedId(null);
        setDraft(emptyDraft());
        setIsEditing(false);
      }
      setIsDeleteConfirmOpen(false);
      setError('');
      // Deletion has succeeded even if this follow-up refresh is unavailable.
      try {
        await refreshBootstrap();
      } catch {
        // Keep the locally updated list and trash so deletion still succeeds.
      }
      return true;
    } catch (err) {
      setError(readError(err, unknownErrorText));
      return false;
    } finally {
      deletingTodoIdRef.current = null;
      setIsDeletingTodo(false);
      setSaving(false);
    }
  }

  async function handleToggleCompleted(todo: Todo) {
    if (togglingTodoIdsRef.current.has(todo.id)) return;
    togglingTodoIdsRef.current.add(todo.id);
    setTogglingTodoIds((current) => [...current, todo.id]);
    try {
      setSaving(true);
      const updated = await backend.toggleCompleted(todo.id);
      setTodos((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (selectedIdRef.current === updated.id) {
        setDraft((current) => ({ ...current, isCompleted: updated.isCompleted }));
      }
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      togglingTodoIdsRef.current.delete(todo.id);
      setTogglingTodoIds((current) => current.filter((id) => id !== todo.id));
      setSaving(false);
    }
  }

  return {
    saveStatus,
    flushCurrentTodo,
    config,
    groups,
    todos,
    notes,
    trash,
    selectedId,
    activeGroupId,
    draft,
    loading,
    isCreatingTodo,
    isDeletingTodo,
    togglingTodoIds,
    quickTitle,
    isEditing,
    isDeleteConfirmOpen,
    selectedTodo,
    setGroups,
    setNotes,
    setTrash,
    setDraft: changeDraft,
    setQuickTitle,
    setIsEditing,
    setIsDeleteConfirmOpen,
    applyBootstrap,
    refreshBootstrap,
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
