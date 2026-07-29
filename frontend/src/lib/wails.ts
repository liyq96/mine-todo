import type { BootstrapResponse, Todo, TodoDraft, TodoGroup } from '../types';

declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          GetBootstrap: () => Promise<BootstrapResponse>;
          ListGroups: () => Promise<TodoGroup[]>;
          UpdateGroup: (payload: { id: string; name: string }) => Promise<TodoGroup>;
          DeleteGroup: (payload: { id: string; deleteTodos: boolean }) => Promise<BootstrapResponse>;
          ListTodos: () => Promise<Todo[]>;
          CreateGroup: (payload: { name: string }) => Promise<TodoGroup>;
          CreateTodo: (payload: Partial<TodoDraft>) => Promise<Todo>;
          UpdateTodo: (payload: Partial<TodoDraft> & { id: string }) => Promise<Todo>;
          DeleteTodo: (id: string) => Promise<void>;
          ToggleTodoCompleted: (id: string) => Promise<Todo>;
          CreateTodoSubitem: (payload: { todoId: string; content: string }) => Promise<Todo>;
          DeleteTodoSubitems: (payload: { todoId: string; ids: string[] }) => Promise<Todo>;
          ToggleTodoSubitemCompleted: (payload: { todoId: string; id: string }) => Promise<Todo>;
          UpdateTodoSubitem: (payload: { todoId: string; id: string; content: string }) => Promise<Todo>;
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
  updateGroup: (payload: { id: string; name: string }) => appBinding().UpdateGroup(payload),
  deleteGroup: (payload: { id: string; deleteTodos: boolean }) => appBinding().DeleteGroup(payload),
  createGroup: (payload: { name: string }) => appBinding().CreateGroup(payload),
  createTodo: (payload: Partial<TodoDraft>) => appBinding().CreateTodo(payload),
  updateTodo: (payload: Partial<TodoDraft> & { id: string }) => appBinding().UpdateTodo(payload),
  deleteTodo: (id: string) => appBinding().DeleteTodo(id),
  toggleCompleted: (id: string) => appBinding().ToggleTodoCompleted(id),
  createSubitem: (payload: { todoId: string; content: string }) => appBinding().CreateTodoSubitem(payload),
  deleteSubitems: (payload: { todoId: string; ids: string[] }) => appBinding().DeleteTodoSubitems(payload),
  toggleSubitemCompleted: (payload: { todoId: string; id: string }) => appBinding().ToggleTodoSubitemCompleted(payload),
  updateSubitem: (payload: { todoId: string; id: string; content: string }) => appBinding().UpdateTodoSubitem(payload),
  updateStorageDirectory: (path: string, copyData: boolean) => appBinding().UpdateStorageDirectory(path, copyData),
  updateLanguage: (language: string) => appBinding().UpdateLanguage(language),
  selectStorageDirectory: () => appBinding().SelectStorageDirectory(),
};
