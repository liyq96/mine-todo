import type { PendingSubitem } from '../appTypes';
import type { Todo, TodoDraft } from '../types';

export const emptyDraft = (): TodoDraft => ({
  title: '',
  summary: '',
  detailMarkdown: '',
  isCompleted: false,
  dueDate: '',
  subitems: [],
});

export function persistableDraft(draft: TodoDraft) {
  return {
    title: draft.title,
    summary: draft.summary,
    detailMarkdown: draft.detailMarkdown,
    isCompleted: draft.isCompleted,
    dueDate: draft.dueDate,
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
    title: todo.title,
    summary: todo.summary,
    detailMarkdown: todo.detailMarkdown,
    isCompleted: todo.isCompleted,
    dueDate: todo.dueDate ? todo.dueDate.slice(0, 10) : '',
    subitems: todo.subitems,
  };
}

export function sortTodos(items: Todo[]) {
  return [...items].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function readError(err: unknown, fallback: string) {
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}
