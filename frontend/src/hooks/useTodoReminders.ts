import { useEffect, useRef } from 'react';
import type { Todo } from '../types';

export function useTodoReminders(databasePath: string, todos: Todo[], title: (value: string) => string) {
  const delivered = useRef({ databasePath, keys: new Set<string>() });
  if (delivered.current.databasePath !== databasePath) delivered.current = { databasePath, keys: new Set() };
  useEffect(() => {
    function notifyDueReminders() {
      if (!databasePath || !('Notification' in window) || Notification.permission !== 'granted') return;
      const now = Date.now();
      for (const todo of todos) {
        const key = JSON.stringify([todo.id, todo.reminderAt]);
        if (!todo.reminderAt || todo.isCompleted || todo.isArchived || delivered.current.keys.has(key)) continue;
        const time = new Date(todo.reminderAt).getTime();
        if (Number.isNaN(time) || time > now) continue;
        try {
          new Notification(title(todo.title), { body: todo.summary || todo.title });
          delivered.current.keys.add(key);
        } catch {
          // Do not consume the reminder when the platform rejects delivery.
        }
      }
    }
    notifyDueReminders();
    const timer = window.setInterval(notifyDueReminders, 30_000);
    return () => window.clearInterval(timer);
  }, [databasePath, todos, title]);
}
