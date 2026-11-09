import type { PendingSubitem } from '../appTypes';
import type { Todo, TodoDraft } from '../types';

export const emptyDraft = (): TodoDraft => ({
  groupId: '',
  title: '',
  summary: '',
  detailMarkdown: '',
  isCompleted: false,
  dueDate: '',
  priority: 'q4',
  reminderAt: '',
  tags: [],
  noteIds: [],
  isFavorite: false,
  isArchived: false,
  subitems: [],
});

export function persistableDraft(draft: TodoDraft) {
  return {
    groupId: draft.groupId,
    title: draft.title,
    summary: draft.summary,
    detailMarkdown: draft.detailMarkdown,
    dueDate: draft.dueDate,
    priority: draft.priority,
    reminderAt: draft.reminderAt,
    tags: draft.tags,
    noteIds: draft.noteIds,
    isFavorite: draft.isFavorite,
    isArchived: draft.isArchived,
  };
}

export function createPendingSubitem(): PendingSubitem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content: '',
  };
}

export function fromTodo(todo: Todo): TodoDraft {
  return {
    groupId: todo.groupId,
    title: todo.title,
    summary: todo.summary,
    detailMarkdown: todo.detailMarkdown,
    isCompleted: todo.isCompleted,
    dueDate: todo.dueDate ? todo.dueDate.slice(0, 10) : '',
    priority: todo.priority,
    reminderAt: todo.reminderAt,
    tags: todo.tags,
    noteIds: todo.noteIds,
    isFavorite: todo.isFavorite,
    isArchived: todo.isArchived,
    subitems: todo.subitems,
  };
}

export function sortTodos(items: Todo[]) {
  return [...items].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function readError(err: unknown, fallback: string) {
  if (typeof err === 'string' && err.trim()) return err;
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}
