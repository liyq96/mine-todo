export interface Todo {
  id: string;
  title: string;
  summary: string;
  detailMarkdown: string;
  isCompleted: boolean;
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
  todos: Todo[];
}

export interface TodoDraft {
  title: string;
  summary: string;
  detailMarkdown: string;
  isCompleted: boolean;
}
