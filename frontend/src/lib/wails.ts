import type { BootstrapResponse, Todo, TodoDraft } from '../types';

declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          GetBootstrap: () => Promise<BootstrapResponse>;
          ListTodos: () => Promise<Todo[]>;
          CreateTodo: (payload: Partial<TodoDraft>) => Promise<Todo>;
          UpdateTodo: (payload: Partial<TodoDraft> & { id: string }) => Promise<Todo>;
          DeleteTodo: (id: string) => Promise<void>;
          ToggleTodoCompleted: (id: string) => Promise<Todo>;
          UpdateStorageDirectory: (path: string, copyData: boolean) => Promise<BootstrapResponse>;
          UpdateLanguage: (language: string) => Promise<BootstrapResponse>;
          SelectStorageDirectory: () => Promise<string>;
        };
      };
    };
  }
}

function appBinding() {
  const binding = window.go?.main?.App;
  if (!binding) {
    throw new Error('Wails runtime binding is unavailable. Please start with `wails dev` or `wails build`.');
  }
  return binding;
}

export const backend = {
  getBootstrap: () => appBinding().GetBootstrap(),
  listTodos: () => appBinding().ListTodos(),
  createTodo: (payload: Partial<TodoDraft>) => appBinding().CreateTodo(payload),
  updateTodo: (payload: Partial<TodoDraft> & { id: string }) => appBinding().UpdateTodo(payload),
  deleteTodo: (id: string) => appBinding().DeleteTodo(id),
  toggleCompleted: (id: string) => appBinding().ToggleTodoCompleted(id),
  updateStorageDirectory: (path: string, copyData: boolean) => appBinding().UpdateStorageDirectory(path, copyData),
  updateLanguage: (language: string) => appBinding().UpdateLanguage(language),
  selectStorageDirectory: () => appBinding().SelectStorageDirectory(),
};
