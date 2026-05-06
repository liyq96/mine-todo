export interface TodoSubitem {
  id: string;
  todoId: string;
  content: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TodoGroup {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id: string;
  groupId: string;
  title: string;
  summary: string;
  detailMarkdown: string;
  isCompleted: boolean;
  dueDate: string;
  subitems: TodoSubitem[];
  createdAt: string;
  updatedAt: string;
}

export interface AppConfig {
  storageDir: string;
  dbPath: string;
  language: 'zh-CN' | 'en-US';
}

export interface BootstrapResponse {
  config: AppConfig;
  groups: TodoGroup[];
  todos: Todo[];
}

export interface TodoDraft {
  groupId: string;
  title: string;
  summary: string;
  detailMarkdown: string;
  isCompleted: boolean;
  dueDate: string;
  subitems: TodoSubitem[];
}
