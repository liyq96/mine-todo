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
  isTrashed: boolean;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  internalLinks: NoteLink[];
  id: string;
  title: string;
  contentMarkdown: string;
  tags: string[];
  todoIds: string[];
  isPinned: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteLink {
  label: string;
  noteId: string;
}

export interface ImportNoteMarkdownInput {
  databasePath: string;
}

export interface ExportNoteMarkdownInput {
  databasePath: string;
  id: string;
}

export interface ExportNoteDocumentInput extends ExportNoteMarkdownInput {
  format: 'docx' | 'pdf';
}

export interface Todo {
  id: string;
  groupId: string;
  title: string;
  summary: string;
  detailMarkdown: string;
  isCompleted: boolean;
  dueDate: string;
  priority: TodoPriority;
  reminderAt: string;
  tags: string[];
  noteIds: string[];
  isFavorite: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  trashedAt: string | null;
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
  notes: Note[];
  trash: TrashData;
}

export interface TrashData {
  groups: TodoGroup[];
  todos: Todo[];
  notes: Note[];
}

export type TodoPriority = 'q1' | 'q2' | 'q3' | 'q4';

export interface TodoDraft {
  groupId: string;
  title: string;
  summary: string;
  detailMarkdown: string;
  isCompleted: boolean;
  dueDate: string;
  priority: TodoPriority;
  reminderAt: string;
  tags: string[];
  noteIds: string[];
  isFavorite: boolean;
  isArchived: boolean;
  subitems: TodoSubitem[];
}

export interface NoteDraft {
  title: string;
  contentMarkdown: string;
  tags: string[];
  todoIds: string[];
  isPinned: boolean;
  isFavorite: boolean;
  isArchived: boolean;
}

export interface TodoUpdateInput extends Omit<TodoDraft, 'isCompleted' | 'subitems'> {
  id: string;
  databasePath: string;
}

export interface NoteUpdateInput extends NoteDraft {
  id: string;
  databasePath: string;
}
