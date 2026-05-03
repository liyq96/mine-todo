import { useCallback, useEffect, useRef } from 'react';
import type { Todo } from '../types';

export function useTodoScrollSync(selectedId: string | null, todos: Todo[]) {
  const todoItemRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingScrollTodoIdRef = useRef<string | null>(null);

  useEffect(() => {
    const targetId = pendingScrollTodoIdRef.current;
    if (!targetId || selectedId !== targetId) {
      return;
    }

    const targetNode = todoItemRefs.current.get(targetId);
    if (!targetNode) {
      return;
    }

    targetNode.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    pendingScrollTodoIdRef.current = null;
  }, [selectedId, todos]);

  const registerTodoRef = useCallback((id: string, node: HTMLButtonElement | null) => {
    if (node) {
      todoItemRefs.current.set(id, node);
      return;
    }
    todoItemRefs.current.delete(id);
  }, []);

  const requestScrollToTodo = useCallback((id: string) => {
    pendingScrollTodoIdRef.current = id;
  }, []);

  return {
    registerTodoRef,
    requestScrollToTodo,
  };
}
