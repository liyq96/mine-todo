import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { AppConfig, Note, NoteDraft, Todo, TodoDraft } from '../src/types';

type TodoUpdate = Omit<TodoDraft, 'isCompleted' | 'subitems'> & { id: string; databasePath: string };
type NoteUpdate = NoteDraft & { id: string; databasePath: string };
type TestState = {
  config: AppConfig; todos: Todo[]; notes: Note[];
  todoWrites: TodoUpdate[]; noteWrites: NoteUpdate[];
  delayNote: boolean; failSaves: boolean; releaseNote: (() => void) | null;
  closeHandler: (() => void) | null; ready: boolean; closed: number;
  notificationPermission: NotificationPermission; notificationFails: boolean;
  notifications: string[]; reminderTick: (() => void) | null;
  delayStorage: boolean; releaseStorage: (() => void) | null;
  markdownResult: 'ok' | 'cancel' | 'fail'; markdownImportCalls: number;
  markdownExports: Array<{ title: string; contentMarkdown: string }>;
  documentExports: Array<{ format: 'docx' | 'pdf'; title: string; contentMarkdown: string }>;
  delayMarkdownImport: boolean; releaseMarkdownImport: (() => void) | null;
};
declare global { interface Window { testState: TestState } }

async function fixture(page: Page, mode = '') {
  await page.addInitScript((mode) => {
    const stamp = '2026-11-09T00:00:00Z';
    const base: Omit<Todo, 'id' | 'title'> = { groupId: 'default', summary: '', detailMarkdown: 'original todo body', isCompleted: false, dueDate: '', priority: 'q4', reminderAt: '', tags: [], noteIds: [], isFavorite: false, isArchived: false, isTrashed: false, trashedAt: null, subitems: [], createdAt: stamp, updatedAt: stamp };
    const noteBase: Omit<Note, 'id' | 'title'> = { contentMarkdown: 'original note body', tags: [], todoIds: [], internalLinks: [], isPinned: false, isFavorite: false, isArchived: false, isTrashed: false, trashedAt: null, createdAt: stamp, updatedAt: stamp };
    const state: TestState = window.testState = {
      config: { language: 'zh-CN', storageDir: 'C:/source', dbPath: 'C:/source/todo.db' },
      todos: [{ ...base, id: 'todo-a', title: '待办 A', reminderAt: ['reminder', 'permission'].includes(mode) ? '2000-01-01T00:00:00Z' : '' }, { ...base, id: 'todo-b', title: '待办 B' }],
      notes: [{ ...noteBase, id: 'note-a', title: '笔记 A' }, { ...noteBase, id: 'note-b', title: '笔记 B' }],
      todoWrites: [], noteWrites: [], delayNote: mode === 'note-delay', failSaves: mode === 'save-fail', releaseNote: null,
      closeHandler: null, ready: false, closed: 0, notificationPermission: mode === 'permission' ? 'denied' : 'granted', notificationFails: false, notifications: [], reminderTick: null,
      delayStorage: mode === 'storage-delay', releaseStorage: null,
      markdownResult: 'ok', markdownImportCalls: 0, markdownExports: [], documentExports: [],
      delayMarkdownImport: mode === 'markdown-delay', releaseMarkdownImport: null,
    };
    if (mode === 'links') {
      state.notes[0].contentMarkdown = '[[Old [A]]]';
      state.notes[0].internalLinks = [{ label: 'Old [A]', noteId: 'note-b' }];
      state.notes[1].title = 'Renamed';
      state.notes.push({ ...noteBase, id: 'note-c', title: 'Old [A]' });
    }
    if (mode === 'hidden-links') {
      state.notes[0].todoIds = ['hidden-todo'];
      state.todos[0].noteIds = ['hidden-note'];
    }
    if (mode === 'subitems') {
      state.todos[0].subitems = ['子项一', '子项二'].map((content, index) => ({
        id: `sub-${index}`, todoId: 'todo-a', content, isCompleted: false, createdAt: stamp, updatedAt: stamp,
      }));
    }
    if (mode === 'priorities') {
      state.todos = ['q1', 'q2', 'q3', 'q4'].map((priority, index) => ({
        ...base, id: `priority-${index}`, title: `优先级待办 ${index + 1}`, priority: priority as Todo['priority'],
        tags: [index === 2 ? '生活' : '工作'], isCompleted: index === 0 || index === 3,
      }));
    }
    if (mode === 'empty-notes') state.notes = [];
    const interval = window.setInterval.bind(window);
    Object.defineProperty(window, 'setInterval', { value: (callback: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay === 30_000 && typeof callback === 'function') state.reminderTick = () => callback(...args);
      return interval(callback, delay, ...args);
    } });
    class TestNotification {
      static get permission() { return state.notificationPermission; }
      static async requestPermission() { return state.notificationPermission; }
      constructor(title: string) { if (state.notificationFails) throw new Error('delivery failed'); state.notifications.push(title); }
    }
    Object.defineProperty(window, 'Notification', { value: TestNotification, configurable: true });
    const snapshot = () => structuredClone({ config: state.config, groups: [{ id: 'default', name: '默认分组', isTrashed: false, trashedAt: null, createdAt: stamp, updatedAt: stamp }], todos: state.todos.filter(t => !t.isTrashed), notes: state.notes.filter(n => !n.isTrashed), trash: { groups: [], todos: state.todos.filter(t => t.isTrashed), notes: state.notes.filter(n => n.isTrashed) } });
    Object.assign(window, {
      runtime: { EventsOnMultiple: (_: string, callback: () => void) => { state.closeHandler = callback; return () => { state.closeHandler = null; }; } },
      go: { main: { App: {
        FrontendReady: async () => { state.ready = true; },
        ConfirmClose: async () => { state.closed += 1; },
        GetBootstrap: async () => snapshot(),
        UpdateLanguage: async (language: AppConfig['language']) => { state.config.language = language; return snapshot(); },
        UpdateTodo: async (input: TodoUpdate) => {
          if (state.failSaves) throw new Error('save failed');
          if (input.databasePath !== state.config.dbPath) throw new Error('database changed');
          state.todoWrites.push(structuredClone(input));
          const todo = state.todos.find(t => t.id === input.id)!;
          Object.assign(todo, input);
          return structuredClone(todo);
        },
        UpdateNote: async (input: NoteUpdate) => {
          if (state.failSaves) throw new Error('save failed');
          state.noteWrites.push(structuredClone(input));
          if (state.delayNote) { state.delayNote = false; await new Promise<void>(resolve => { state.releaseNote = resolve; }); }
          if (input.databasePath !== state.config.dbPath) throw new Error('database changed');
          const note = state.notes.find(n => n.id === input.id)!;
          Object.assign(note, input);
          return structuredClone(note);
        },
        CreateTodo: async (input: Partial<TodoDraft>) => { const todo = { ...base, ...input, id: `todo-${state.todos.length}`, title: input.title || '新建待办' }; state.todos.push(todo); return structuredClone(todo); },
        CreateNote: async (input: NoteDraft) => { const note = { ...noteBase, ...input, id: `note-${state.notes.length}` }; state.notes.push(note); return structuredClone(note); },
        ImportNoteMarkdown: async (input: { databasePath: string }) => {
          state.markdownImportCalls += 1;
          if (state.delayMarkdownImport) await new Promise<void>(resolve => { state.releaseMarkdownImport = resolve; });
          if (state.markdownResult === 'cancel') return null;
          if (state.markdownResult === 'fail') throw new Error('markdown file must be utf-8');
          if (input.databasePath !== state.config.dbPath) throw new Error('database changed');
          const note = { ...noteBase, id: `import-${state.notes.length}`, title: '笔记 A', contentMarkdown: '# 导入内容\n\n- [ ] 保留 Markdown\n' };
          state.notes.push(note);
          return structuredClone(note);
        },
        ExportNoteMarkdown: async (input: { databasePath: string; id: string }) => {
          if (state.markdownResult === 'cancel') return false;
          if (state.markdownResult === 'fail') throw new Error('export failed');
          if (input.databasePath !== state.config.dbPath) throw new Error('database changed');
          const note = state.notes.find(note => note.id === input.id)!;
          state.markdownExports.push({ title: note.title, contentMarkdown: note.contentMarkdown });
          return true;
        },
        ExportNoteDocument: async (input: { databasePath: string; id: string; format: 'docx' | 'pdf' }) => {
          if (state.markdownResult === 'cancel') return false;
          if (state.markdownResult === 'fail') throw new Error('export failed');
          if (input.databasePath !== state.config.dbPath) throw new Error('database changed');
          const note = state.notes.find(note => note.id === input.id)!;
          state.documentExports.push({ format: input.format, title: note.title, contentMarkdown: note.contentMarkdown });
          return true;
        },
        DeleteTodo: async (id: string) => { state.todos.find(t => t.id === id)!.isTrashed = true; },
        DeleteNote: async (id: string) => { state.notes.find(n => n.id === id)!.isTrashed = true; },
        ToggleTodoCompleted: async (id: string) => { const todo = state.todos.find(t => t.id === id)!; todo.isCompleted = !todo.isCompleted; return structuredClone(todo); },
        CreateTodoSubitem: async (input: { todoId: string; content: string }) => { const todo = state.todos.find(t => t.id === input.todoId)!; todo.subitems.push({ ...input, id: `sub-${todo.subitems.length}`, isCompleted: false, createdAt: stamp, updatedAt: stamp }); return structuredClone(todo); },
        ToggleTodoSubitemCompleted: async (input: { todoId: string; id: string }) => {
          const todo = state.todos.find(t => t.id === input.todoId)!;
          const subitem = todo.subitems.find(s => s.id === input.id)!;
          subitem.isCompleted = !subitem.isCompleted;
          return structuredClone(todo);
        },
        DeleteTodoSubitems: async (input: { todoId: string; ids: string[] }) => {
          if (state.failSaves) throw new Error('delete failed');
          const todo = state.todos.find(t => t.id === input.todoId)!;
          todo.subitems = todo.subitems.filter(s => !input.ids.includes(s.id));
          return structuredClone(todo);
        },
        SelectStorageDirectory: async () => 'C:/target',
        UpdateStorageDirectory: async (_: string, copy: boolean) => {
          if (copy) throw new Error('target database already exists');
          if (state.delayStorage) await new Promise<void>(resolve => { state.releaseStorage = resolve; });
          state.config = { ...state.config, storageDir: 'C:/target', dbPath: 'C:/target/todo.db' };
          state.notes = state.notes.map(n => ({ ...n, contentMarkdown: 'target database unique content' }));
          return snapshot();
        },
      } } },
    });
  }, mode);
  await page.goto('/');
  await expect(page.locator('.todo-row')).toHaveCount(mode === 'priorities' ? 4 : 2);
}

async function editNote(page: Page) {
  await page.getByRole('button', { name: '笔记', exact: true }).click();
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  return page.locator('.note-content-input');
}

async function transferMarkdown(page: Page, action: 'import' | 'export') {
  await page.getByRole('button', { name: '导入/导出', exact: true }).click();
  await page.getByRole('menuitem', { name: action === 'import' ? '导入 Markdown' : '导出 Markdown', exact: true }).click();
}

test('note transfer menu has separate import and export sections', async ({ page }, testInfo) => {
  await fixture(page);
  await page.getByRole('button', { name: '笔记', exact: true }).click();
  await expect(page.locator('.sidebar .note-transfer-button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '导入 Markdown', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '导出 Markdown', exact: true })).toHaveCount(0);
  const trigger = page.getByRole('button', { name: '导入/导出', exact: true });
  await trigger.click();
  const menu = page.getByRole('menu', { name: '导入/导出', exact: true });
  await expect(menu.getByRole('group', { name: '导入', exact: true }).getByRole('menuitem')).toHaveText(['Markdown']);
  await expect(menu.getByRole('group', { name: '导出', exact: true }).getByRole('menuitem')).toHaveText(['Markdown', 'Word (.docx)', 'PDF']);
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitem', { name: '导出 PDF', exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('note-transfer-menu.png') });
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('Markdown import creates a new note and export flushes the latest edits', async ({ page }, testInfo) => {
  await fixture(page);
  await page.getByRole('button', { name: '笔记', exact: true }).click();
  await transferMarkdown(page, 'import');
  await expect(page.locator('.note-list__item')).toHaveCount(3);
  await expect(page.locator('.note-preview')).toContainText('导入内容');
  expect(await page.evaluate(() => window.testState.notes.filter(note => note.title === '笔记 A').length)).toBe(2);
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.locator('.note-title-input').fill('最新导出标题');
  await page.locator('.note-content-input').fill('# 最新正文\n\n**保留格式**');
  await transferMarkdown(page, 'export');
  await expect.poll(() => page.evaluate(() => window.testState.markdownExports)).toEqual([
    { title: '最新导出标题', contentMarkdown: '# 最新正文\n\n**保留格式**' },
  ]);
  await page.screenshot({ path: testInfo.outputPath('markdown-actions.png') });
});

for (const [label, format] of [['Word', 'docx'], ['PDF', 'pdf']] as const) {
  test(`${label} export saves the latest title and body and handles cancellation and failure`, async ({ page }) => {
    await fixture(page);
    const content = await editNote(page);
    await page.locator('.note-title-input').fill('最新文档标题');
    await content.fill('## 最新正文\n\n**中文内容**');
    const exportFile = async () => {
      await page.getByRole('button', { name: '导入/导出', exact: true }).click();
      await page.getByRole('menuitem', { name: `导出 ${label}`, exact: true }).click();
    };
    await exportFile();
    await expect.poll(() => page.evaluate(() => window.testState.documentExports)).toEqual([
      { format, title: '最新文档标题', contentMarkdown: '## 最新正文\n\n**中文内容**' },
    ]);
    await page.evaluate(() => { window.testState.markdownResult = 'cancel'; });
    await exportFile();
    await expect(page.getByRole('button', { name: '导入/导出', exact: true })).toBeEnabled();
    await expect(content).toHaveValue('## 最新正文\n\n**中文内容**');
    await page.evaluate(() => { window.testState.markdownResult = 'fail'; });
    await exportFile();
    await expect(page.locator('.error-banner')).toHaveText('export failed');
    expect(await page.evaluate(() => window.testState.documentExports.length)).toBe(1);
    await expect(content).toHaveValue('## 最新正文\n\n**中文内容**');
  });
}

test('Markdown cancellation and failures retain the selected note and draft', async ({ page }) => {
  await fixture(page);
  const input = await editNote(page);
  await input.fill('keep this content');
  await page.evaluate(() => { window.testState.markdownResult = 'cancel'; });
  await transferMarkdown(page, 'import');
  await expect(page.locator('.note-list__item')).toHaveCount(2);
  await expect(input).toHaveValue('keep this content');
  await transferMarkdown(page, 'export');
  await expect(page.locator('.error-banner')).toHaveCount(0);
  await page.evaluate(() => { window.testState.markdownResult = 'fail'; });
  await transferMarkdown(page, 'import');
  await expect(page.locator('.error-banner')).toContainText('UTF-8');
  await expect(input).toHaveValue('keep this content');
  await expect(page.locator('.note-list__item')).toHaveCount(2);
  await transferMarkdown(page, 'export');
  await expect(page.locator('.error-banner')).toContainText('export failed');
  await expect(input).toHaveValue('keep this content');
});

test('Markdown import is available with no notes', async ({ page }) => {
  await fixture(page, 'empty-notes');
  await page.getByRole('button', { name: '笔记', exact: true }).click();
  await page.getByRole('button', { name: '导入/导出', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: '导出 Markdown', exact: true })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: '导出 Word', exact: true })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: '导出 PDF', exact: true })).toBeDisabled();
  await page.getByRole('menuitem', { name: '导入 Markdown', exact: true }).click();
  await expect(page.locator('.note-list__item')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '导入/导出', exact: true })).toBeVisible();
});

test('close waits for the Markdown import', async ({ page }) => {
  await fixture(page, 'markdown-delay');
  await page.getByRole('button', { name: '笔记', exact: true }).click();
  await transferMarkdown(page, 'import');
  await expect.poll(() => page.evaluate(() => Boolean(window.testState.releaseMarkdownImport))).toBe(true);
  await page.evaluate(() => window.testState.closeHandler?.());
  expect(await page.evaluate(() => window.testState.closed)).toBe(0);
  await page.evaluate(() => window.testState.releaseMarkdownImport?.());
  await expect.poll(() => page.evaluate(() => window.testState.closed)).toBe(1);
  expect(await page.evaluate(() => window.testState.notes.length)).toBe(3);
});

test('priority filters compose with views and tags and apply only to todos', async ({ page }, testInfo) => {
  await fixture(page, 'priorities');
  const trigger = page.getByRole('button', { name: '筛选', exact: true });
  await trigger.click();
  const menu = page.locator('.sidebar-filter-menu');
  const priorities = menu.getByRole('group', { name: '优先级', exact: true });
  const options = ['紧急且重要', '重要不紧急', '紧急不重要', '不紧急不重要'];
  for (const [index, name] of options.entries()) {
    const option = priorities.getByRole('menuitemradio', { name, exact: true });
    await option.click();
    await expect(option).toBeChecked();
    await expect(page.locator('.todo-row')).toHaveCount(1);
    await expect(page.locator('.todo-row')).toContainText(`优先级待办 ${index + 1}`);
    await expect(trigger.locator('.sidebar-filter-button__count')).toHaveText('1');
  }
  await priorities.getByRole('menuitemradio', { name: options[1], exact: true }).click();
  await menu.getByRole('menuitemradio', { name: '#工作', exact: true }).click();
  await expect(trigger.locator('.sidebar-filter-button__count')).toHaveText('2');
  const views = menu.getByRole('group', { name: '视图', exact: true });
  await views.getByRole('menuitemradio', { name: '已完成', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(0);
  await expect(trigger.locator('.sidebar-filter-button__count')).toHaveText('3');
  await views.getByRole('menuitemradio', { name: '全部', exact: true }).click();
  await priorities.getByRole('menuitemradio', { name: '全部优先级', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(3);
  await menu.getByRole('menuitem', { name: '清除筛选', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(4);
  await expect(trigger).toHaveAttribute('aria-pressed', 'false');
  await priorities.getByRole('menuitemradio', { name: options[0], exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('priority-filter.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '笔记', exact: true }).click();
  await trigger.click();
  await expect(menu.getByRole('group', { name: '优先级', exact: true })).toHaveCount(0);
  await expect(trigger).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.note-list__item')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '待办', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);
  await expect(trigger.locator('.sidebar-filter-button__count')).toHaveText('1');
});

test('editing subitems uses completion controls and removes each row directly', async ({ page }, testInfo) => {
  await fixture(page, 'subitems');
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  for (let index = 0; index < 2; index += 1) {
    await page.locator('.subitem-toggle-button').nth(index).click();
    await expect(page.locator('.subitem-toggle-button').nth(index)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.sidebar__topbar')).toBeInViewport();
    expect(await page.locator('.shell').evaluate(node => node.scrollTop)).toBe(0);
    expect((await page.locator('.sidebar').boundingBox())?.y).toBe(0);
  }
  await page.locator('.subitem-toggle-button').last().press('Space');
  await expect(page.locator('.subitem-toggle-button').last()).toHaveAttribute('aria-pressed', 'false');
  expect(await page.locator('.shell').evaluate(node => node.scrollTop)).toBe(0);
  await expect(page.getByRole('button', { name: '删除选中', exact: true })).toHaveCount(0);
  await expect(page.locator('.subitems-list input[type="checkbox"]')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('subitem-actions.png') });
  await page.locator('.subitem-row').first().getByRole('button', { name: '移除子项' }).click();
  await expect(page.locator('.subitem-row')).toHaveCount(1);
  await expect(page.locator('.subitem-row')).toContainText('子项二');
  expect(await page.evaluate(() => window.testState.todos[0].subitems.map(s => s.id))).toEqual(['sub-1']);
});

test('completing subitems keeps the sidebar anchored', async ({ page }) => {
  await fixture(page, 'subitems');
  for (let index = 0; index < 2; index += 1) {
    await page.locator('.subitem-complete-button').nth(index).click();
    await expect(page.locator('.subitem-row.is-completed')).toHaveCount(index + 1);
    await expect(page.locator('.sidebar__topbar')).toBeInViewport();
    await expect(page.locator('.sidebar-trash-button')).toBeInViewport();
    expect(await page.locator('.shell').evaluate(node => node.scrollTop)).toBe(0);
    expect((await page.locator('.sidebar').boundingBox())?.y).toBe(0);
  }
});

test('remove is available only while editing and retains the row on failure', async ({ page }) => {
  await fixture(page, 'subitems');
  await expect(page.locator('.subitem-remove-button')).toHaveCount(0);
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await expect(page.locator('.subitem-remove-button')).toHaveCount(2);
  await page.evaluate(() => { window.testState.failSaves = true; });
  await page.locator('.subitem-remove-button').first().click();
  await expect(page.locator('.error-banner')).toBeVisible();
  await expect(page.locator('.subitem-row')).toHaveCount(2);
  await page.evaluate(() => { window.testState.failSaves = false; });
  await page.locator('.subitem-remove-button').first().click();
  await expect(page.locator('.subitem-row')).toHaveCount(1);
  await expect(page.locator('.subitem-row')).toContainText('子项二');
  expect(await page.evaluate(() => window.testState.todos[0].subitems[0].isCompleted)).toBe(false);
  await page.getByRole('button', { name: '预览', exact: true }).click();
  await expect(page.locator('.subitem-remove-button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '预览', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.detail-toolbar .note-delete-button')).toHaveText('');
  await expect(page.locator('.detail-toolbar .note-delete-button')).toHaveAccessibleName('删除');
});

test('minus discards a pending subitem without saving it', async ({ page }) => {
  await fixture(page);
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  for (const keyboard of [false, true]) {
    await page.getByRole('button', { name: '添加子项', exact: true }).click();
    await page.locator('.subitem-input').fill('discard this child');
    if (keyboard) {
      await page.locator('.subitem-input').press('Tab');
      await expect(page.locator('.subitem-remove-button')).toBeFocused();
      await page.locator('.subitem-remove-button').press('Enter');
    } else {
      await page.locator('.subitem-remove-button').click();
    }
    await expect(page.locator('.subitem-row')).toHaveCount(0);
    expect(await page.evaluate(() => window.testState.todos[0].subitems)).toEqual([]);
  }
});

test('subitem focus and window resizing keep the workspace anchored', async ({ page }) => {
  await page.setViewportSize({ width: 1042, height: 678 });
  await fixture(page);
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByRole('button', { name: '添加子项', exact: true }).click();
  await expect(page.locator('.subitem-input')).toBeFocused();
  await expect(page.locator('.subitem-input')).toHaveCSS('outline-style', 'none');
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  const focusColor = await page.evaluate((color) => {
    const probe = document.createElement('span');
    probe.style.color = color;
    document.body.append(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  }, accent);
  await expect(page.locator('.subitem-row.is-pending')).toHaveCSS('border-top-color', focusColor);
  for (const size of [{ width: 1042, height: 678 }, { width: 1080, height: 720 }, { width: 1360, height: 860 }]) {
    await page.setViewportSize(size);
    const sidebar = await page.locator('.sidebar').boundingBox();
    expect(sidebar?.y).toBe(0);
    expect(sidebar!.y + sidebar!.height).toBe(size.height);
    const panel = await page.locator('.detail-panel').boundingBox();
    expect(panel?.y).toBe(0);
    expect(panel!.y + panel!.height).toBe(size.height);
  }
  await expect(page.locator('.sidebar__topbar')).toBeInViewport();
  await expect(page.locator('.sidebar-trash-button')).toBeInViewport();
});

test('rapid todo selection flushes the latest draft', async ({ page }) => {
  await fixture(page);
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.locator('.detail-textarea').fill('latest todo content');
  await page.locator('.todo-row').nth(1).click();
  await expect.poll(() => page.evaluate(() => window.testState.todos[0].detailMarkdown)).toBe('latest todo content');
  await page.locator('.todo-row').first().click();
  await expect(page.locator('.preview-content')).toContainText('latest todo content');
});

test('failed save keeps the draft and selection, retry can navigate', async ({ page }) => {
  await fixture(page, 'save-fail');
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.locator('.detail-textarea').fill('keep this draft');
  await page.locator('.todo-row').nth(1).click();
  await expect(page.locator('.detail-textarea')).toHaveValue('keep this draft');
  await expect(page.locator('.todo-row.is-active')).toContainText('待办 A');
  await page.evaluate(() => { window.testState.failSaves = false; });
  await page.locator('.todo-row').nth(1).click();
  await expect(page.locator('.todo-row.is-active')).toContainText('待办 B');
});

test('in-flight note save cannot override a revert or newer content', async ({ page }) => {
  await fixture(page, 'note-delay');
  const input = await editNote(page);
  await input.fill('older in-flight content');
  await page.waitForFunction(() => window.testState.releaseNote !== null);
  await input.fill('original note body');
  await page.evaluate(() => { window.testState.delayNote = true; });
  await page.evaluate(() => window.testState.releaseNote?.());
  await expect.poll(() => page.evaluate(() => window.testState.noteWrites.length)).toBe(2);
  await expect(input).toHaveValue('original note body');
  await page.evaluate(() => window.testState.releaseNote?.());
  await expect.poll(() => page.evaluate(() => window.testState.notes[0].contentMarkdown)).toBe('original note body');
  await input.fill('newest content');
  await expect.poll(() => page.evaluate(() => window.testState.notes[0].contentMarkdown)).toBe('newest content');
});

test('database conflict is explicit and same-id notes never auto-overwrite target', async ({ page }) => {
  await fixture(page);
  await editNote(page);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '选择目录', exact: true }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.locator('.settings-confirm-card').getByRole('button').filter({ hasText: '迁移现有数据' }).click();
  await expect(page.locator('.settings-modal [role="alert"]')).toContainText('目标目录已有数据库');
  await expect.poll(() => page.evaluate(() => window.testState.config.dbPath)).toBe('C:/source/todo.db');
  await page.locator('.settings-confirm-card').getByRole('button').filter({ hasText: '打开目标目录' }).click();
  await expect(page.locator('.note-preview')).toContainText('target database unique content');
  await page.waitForTimeout(850);
  expect(await page.evaluate(() => window.testState.noteWrites.length)).toBe(0);
});

test('an input event and an old response in the same turn retain the new text', async ({ page }) => {
  await fixture(page, 'note-delay');
  const input = await editNote(page);
  await input.fill('older content');
  await page.waitForFunction(() => window.testState.releaseNote !== null);
  await input.evaluate((element) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(element, 'new content in same turn');
    element.dispatchEvent(new Event('input', { bubbles: true }));
    window.testState.releaseNote?.();
  });
  await expect(input).toHaveValue('new content in same turn');
  await expect.poll(() => page.evaluate(() => window.testState.notes[0].contentMarkdown)).toBe('new content in same turn');
});

test('closing during a database switch waits and never writes an old note to the new database', async ({ page }) => {
  await fixture(page, 'storage-delay');
  await editNote(page);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '选择目录', exact: true }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.locator('.settings-confirm-card').getByRole('button').filter({ hasText: '打开目标目录' }).click();
  await page.waitForFunction(() => window.testState.releaseStorage !== null);
  await page.evaluate(() => window.testState.closeHandler?.());
  expect(await page.evaluate(() => window.testState.closed)).toBe(0);
  await page.evaluate(() => window.testState.releaseStorage?.());
  await expect.poll(() => page.evaluate(() => window.testState.closed)).toBe(1);
  expect(await page.evaluate(() => window.testState.noteWrites.length)).toBe(0);
  expect(await page.evaluate(() => window.testState.notes[0].contentMarkdown)).toBe('target database unique content');
});

test('Chinese composition does not open a search result', async ({ page }) => {
  await fixture(page);
  await page.keyboard.press('Control+k');
  const search = page.locator('.global-search-field input');
  await search.fill('笔记');
  await expect(page.locator('.global-search-result')).toHaveCount(2);
  await search.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true });
  await expect(page.locator('.global-search-dialog')).toBeVisible();
  await search.press('Enter');
  await expect(page.locator('.note-preview')).toBeVisible();
});

test('rescheduling delivers again without repeating a delivered timestamp', async ({ page }) => {
  await fixture(page, 'reminder');
  await expect.poll(() => page.evaluate(() => window.testState.notifications.length)).toBe(1);
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByRole('button', { name: '时间', exact: true }).click();
  await page.locator('input[type="datetime-local"]').fill('2001-01-01T12:00');
  await page.locator('.todo-schedule-dialog__apply').click();
  await expect.poll(() => page.evaluate(() => window.testState.notifications.length)).toBe(2);
  await page.evaluate(() => window.testState.reminderTick?.());
  expect(await page.evaluate(() => window.testState.notifications.length)).toBe(2);
});

test('permission and delivery failures do not consume reminders', async ({ page }) => {
  await fixture(page, 'permission');
  expect(await page.evaluate(() => window.testState.notifications.length)).toBe(0);
  await page.evaluate(() => { window.testState.notificationPermission = 'granted'; window.testState.notificationFails = true; window.testState.reminderTick?.(); });
  expect(await page.evaluate(() => window.testState.notifications.length)).toBe(0);
  await page.evaluate(() => { window.testState.notificationFails = false; window.testState.reminderTick?.(); });
  expect(await page.evaluate(() => window.testState.notifications.length)).toBe(1);
});

test('renamed note links keep identity even when an old-title duplicate exists', async ({ page }) => {
  await fixture(page, 'links');
  await page.getByRole('button', { name: '笔记', exact: true }).click();
  await page.getByRole('link', { name: 'Old [A]', exact: true }).click();
  await expect(page.locator('.note-title-input')).toHaveValue('Renamed');
  await expect(page.locator('.note-relations')).toContainText('笔记 A');
});

test('close waits for unsaved content; failed save keeps the application open', async ({ page }) => {
  await fixture(page, 'save-fail');
  const input = await editNote(page);
  await input.fill('save before closing');
  await page.evaluate(() => window.testState.closeHandler?.());
  await expect(page.locator('.save-hint')).toContainText('保存失败');
  expect(await page.evaluate(() => window.testState.closed)).toBe(0);
  await page.evaluate(() => { window.testState.failSaves = false; window.testState.closeHandler?.(); });
  await expect.poll(() => page.evaluate(() => window.testState.closed)).toBe(1);
  expect(await page.evaluate(() => window.testState.notes[0].contentMarkdown)).toBe('save before closing');
});

test('close flushes a pending subitem without requiring Enter', async ({ page }) => {
  await fixture(page);
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByRole('button', { name: '添加子项', exact: true }).click();
  await page.locator('.subitem-input').fill('pending child');
  await page.evaluate(() => window.testState.closeHandler?.());
  await expect.poll(() => page.evaluate(() => window.testState.closed)).toBe(1);
  expect(await page.evaluate(() => window.testState.todos[0].subitems.map(s => s.content))).toEqual(['pending child']);
});

test('close drains an older write and the latest draft in order', async ({ page }) => {
  await fixture(page, 'note-delay');
  const input = await editNote(page);
  await input.fill('older queued content');
  await page.waitForFunction(() => window.testState.releaseNote !== null);
  await input.fill('final content before close');
  await page.evaluate(() => window.testState.closeHandler?.());
  expect(await page.evaluate(() => window.testState.closed)).toBe(0);
  await page.evaluate(() => window.testState.releaseNote?.());
  await expect.poll(() => page.evaluate(() => window.testState.closed)).toBe(1);
  expect(await page.evaluate(() => window.testState.notes[0].contentMarkdown)).toBe('final content before close');
});

test('save failure exposes a working retry action', async ({ page }) => {
  await fixture(page, 'save-fail');
  const input = await editNote(page);
  await input.fill('retry this content');
  const retry = page.getByRole('button', { name: '保存失败 · 重试', exact: true });
  await expect(retry).toBeVisible();
  await page.evaluate(() => { window.testState.failSaves = false; });
  await retry.click();
  await expect(page.locator('.save-hint')).toHaveText('已保存');
  expect(await page.evaluate(() => window.testState.notes[0].contentMarkdown)).toBe('retry this content');
});

test('deleting a note immediately refreshes the recycle bin', async ({ page }) => {
  await fixture(page);
  await page.getByRole('button', { name: '笔记', exact: true }).click();
  await page.getByRole('button', { name: '删除笔记', exact: true }).click();
  await page.getByRole('button', { name: '移入回收站', exact: true }).click();
  await page.locator('.sidebar-trash-button').click();
  await expect(page.locator('.trash-row')).toHaveCount(1);
  await expect(page.locator('.trash-row')).toContainText('笔记 A');
});

test('hidden related items are not counted or selected in relation dialogs', async ({ page }) => {
  await fixture(page, 'hidden-links');
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  const noteLink = page.getByRole('button', { name: '关联笔记', exact: true });
  await expect(noteLink.locator('.todo-property-button__count')).toHaveCount(0);
  await noteLink.click();
  await expect(page.locator('.relation-picker__footer')).toContainText('已关联 0 项');
  await page.locator('.relation-picker__footer button').click();
  await page.getByRole('button', { name: '笔记', exact: true }).click();
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  const todoLink = page.getByRole('button', { name: '关联待办', exact: true });
  await expect(todoLink.locator('.todo-property-button__count')).toHaveCount(0);
});

test('compact tags, centered caret and bottom-right count survive long note editing', async ({ page }) => {
  await fixture(page);
  const input = await editNote(page);
  const content = Array.from({ length: 60 }, (_, index) => `第 ${index + 1} 行：工作记录与计划。`).join('\n');
  await input.fill(content);
  await input.press('Control+End');
  await expect.poll(() => input.evaluate(el => {
    const editor = document.querySelector('.note-editor')!;
    const toolbar = document.querySelector<HTMLElement>('.note-toolbar')!;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    const target = editor.getBoundingClientRect().top + toolbar.offsetHeight + (editor.clientHeight - toolbar.offsetHeight) / 2;
    return Math.abs(el.getBoundingClientRect().bottom - lineHeight / 2 - target);
  })).toBeLessThan(20);
  const count = page.locator('.note-character-count');
  await expect(count).toHaveText(`${content.length} 字符`);
  const box = await count.boundingBox();
  expect(Math.round(box!.x + box!.width)).toBe(1054);
  expect(Math.round(box!.y + box!.height)).toBe(764);
  await expect(page.locator('.note-paper__footer')).toHaveCount(0);
  await page.locator('.note-metadata-editor').getByRole('button', { name: '标签', exact: true }).click();
  const tag = page.getByRole('textbox', { name: '标签', exact: true });
  expect((await tag.boundingBox())!.width).toBeLessThan(210);
  await tag.fill('工作, 计划');
  await tag.press('Enter');
  await expect(page.locator('.note-metadata-editor .todo-tag')).toHaveCount(2);
});

test('dialogs have accessible names and return keyboard focus to their opener', async ({ page }) => {
  await fixture(page);
  const settings = page.getByRole('button', { name: '设置', exact: true });
  await settings.click();
  await expect(page.getByRole('dialog', { name: '设置', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(settings).toBeFocused();
  await editNote(page);
  const relation = page.getByRole('button', { name: '关联待办', exact: true });
  await relation.click();
  await expect(page.getByRole('dialog', { name: '关联待办', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(relation).toBeFocused();
});

test('language cards support whole-row selection and keyboard navigation', async ({ page }, testInfo) => {
  await fixture(page);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '语言', exact: true }).click();
  const chinese = page.getByRole('radio', { name: '简体中文', exact: true });
  const english = page.getByRole('radio', { name: 'English', exact: true });
  await expect(chinese).toBeChecked();
  await expect(english).not.toBeChecked();
  await english.getByText('English', { exact: true }).click();
  await expect(english).toBeChecked();
  await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.testState.config.language)).toBe('en-US');
  await expect(english).toBeEnabled();
  await english.focus();
  await page.keyboard.down('ArrowUp');
  await expect(chinese).toBeChecked();
  await page.keyboard.up('ArrowUp');
  await expect(chinese).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('language-cards.png') });
});
