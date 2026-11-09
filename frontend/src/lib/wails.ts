import type { BootstrapResponse, Note, NoteDraft, NoteUpdateInput, Todo, TodoDraft, TodoGroup, TodoUpdateInput } from '../types';

declare global {
  interface Window {
    runtime?: { EventsOnMultiple: (event: string, callback: () => void, count: number) => () => void };
    go?: {
      main?: {
        App?: {
          FrontendReady: () => Promise<void>;
          ConfirmClose: () => Promise<void>;
          GetBootstrap: () => Promise<BootstrapResponse>;
          ListGroups: () => Promise<TodoGroup[]>;
          UpdateGroup: (payload: { id: string; name: string }) => Promise<TodoGroup>;
          DeleteGroup: (payload: { id: string; deleteTodos: boolean }) => Promise<BootstrapResponse>;
          ListTodos: () => Promise<Todo[]>;
          ListNotes: () => Promise<Note[]>;
          CreateNote: (payload: NoteDraft) => Promise<Note>;
          UpdateNote: (payload: NoteUpdateInput) => Promise<Note>;
          DeleteNote: (id: string) => Promise<void>;
          RestoreNote: (id: string) => Promise<BootstrapResponse>;
          PurgeNote: (id: string) => Promise<BootstrapResponse>;
          CreateGroup: (payload: { name: string }) => Promise<TodoGroup>;
          CreateTodo: (payload: Partial<TodoDraft>) => Promise<Todo>;
          UpdateTodo: (payload: TodoUpdateInput) => Promise<Todo>;
          DeleteTodo: (id: string) => Promise<void>;
          RestoreTodo: (id: string) => Promise<BootstrapResponse>;
          PurgeTodo: (id: string) => Promise<BootstrapResponse>;
          PurgeTrash: () => Promise<BootstrapResponse>;
          RestoreGroup: (id: string) => Promise<BootstrapResponse>;
          PurgeGroup: (id: string) => Promise<BootstrapResponse>;
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
  onCloseRequested: (callback: () => void) => {
    const binding = window.go?.main?.App;
    if (!window.runtime?.EventsOnMultiple || !binding?.FrontendReady) return () => {};
    const unsubscribe = window.runtime.EventsOnMultiple('app:close-requested', callback, -1);
    void binding.FrontendReady();
    return unsubscribe;
  },
  confirmClose: () => appBinding().ConfirmClose(),
  getBootstrap: () => appBinding().GetBootstrap(),
  listNotes: () => appBinding().ListNotes(),
  createNote: (payload: NoteDraft) => appBinding().CreateNote(payload),
  updateNote: (payload: NoteUpdateInput) => appBinding().UpdateNote(payload),
  deleteNote: (id: string) => appBinding().DeleteNote(id),
  restoreNote: (id: string) => appBinding().RestoreNote(id),
  purgeNote: (id: string) => appBinding().PurgeNote(id),
  updateGroup: (payload: { id: string; name: string }) => appBinding().UpdateGroup(payload),
  deleteGroup: (payload: { id: string; deleteTodos: boolean }) => appBinding().DeleteGroup(payload),
  createGroup: (payload: { name: string }) => appBinding().CreateGroup(payload),
  createTodo: (payload: Partial<TodoDraft>) => appBinding().CreateTodo(payload),
  updateTodo: (payload: TodoUpdateInput) => appBinding().UpdateTodo(payload),
  deleteTodo: (id: string) => appBinding().DeleteTodo(id),
  restoreTodo: (id: string) => appBinding().RestoreTodo(id),
  purgeTodo: (id: string) => appBinding().PurgeTodo(id),
  purgeTrash: () => appBinding().PurgeTrash(),
  restoreGroup: (id: string) => appBinding().RestoreGroup(id),
  purgeGroup: (id: string) => appBinding().PurgeGroup(id),
  toggleCompleted: (id: string) => appBinding().ToggleTodoCompleted(id),
  createSubitem: (payload: { todoId: string; content: string }) => appBinding().CreateTodoSubitem(payload),
  deleteSubitems: (payload: { todoId: string; ids: string[] }) => appBinding().DeleteTodoSubitems(payload),
  toggleSubitemCompleted: (payload: { todoId: string; id: string }) => appBinding().ToggleTodoSubitemCompleted(payload),
  updateSubitem: (payload: { todoId: string; id: string; content: string }) => appBinding().UpdateTodoSubitem(payload),
  updateStorageDirectory: (path: string, copyData: boolean) => appBinding().UpdateStorageDirectory(path, copyData),
  updateLanguage: (language: string) => appBinding().UpdateLanguage(language),
  selectStorageDirectory: () => appBinding().SelectStorageDirectory(),
};
