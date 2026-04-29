import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useEffect, useMemo, useRef, useState } from 'react';
import { backend } from './lib/wails';
import type { AppConfig, BootstrapResponse, Todo, TodoDraft } from './types';

const APP_INFO = {
  name: 'Mine ToDo',
  version: '1.0.0',
  releaseDate: '2026-04-29',
};

type Locale = 'zh-CN' | 'en-US';
type SettingsTab = 'data' | 'language' | 'about';
type SaveStatus = 'saved' | 'typing' | 'saving' | 'failed';
type DirectorySwitchMode = 'copy' | 'fresh';

const messages = {
  'zh-CN': {
    setting: '设置',
    remainingCount: (count: number) => `${count} 项未完成`,
    totalCount: (count: number) => `${count} 项全部`,
    quickAddPlaceholder: '快速添加提醒，回车创建',
    loading: '正在加载...',
    emptyTodos: '还没有待办，先创建第一条。',
    untitledTodo: '未命名待办',
    noSummary: '无备注',
    blankTitle: '选择一个待办',
    blankDescription: '左侧选中后，在右侧查看详情或进入编辑。',
    exitEdit: '退出编辑',
    edit: '编辑',
    delete: '删除',
    titlePlaceholder: '标题',
    summaryPlaceholder: '添加备注',
    markdown: 'Markdown',
    markdownPlaceholder: '# 今天要做什么？\n\n- 任务一\n- 任务二',
    newTodoTitle: '新建待办',
    saveStatus: {
      saved: '已保存',
      typing: '正在输入...',
      saving: '保存中...',
      failed: '保存失败',
    },
    settingsTitle: '设置',
    close: '关闭',
    tabs: {
      data: '数据',
      language: '语言',
      about: '关于',
    },
    dataTitle: '数据保存目录',
    dataDescription: '管理本地 SQLite 数据保存位置。',
    directoryLabel: '当前目录',
    chooseDirectory: '选择目录',
    cancel: '取消',
    saveDirectory: '保存目录',
    switchDirectoryTitle: '切换数据目录',
    switchDirectoryDescription: '请选择切换到新目录时的处理方式。',
    switchDirectoryCopy: '迁移旧数据',
    switchDirectoryCopyHint: '将当前目录里的 todo.db 复制到新目录后再切换。',
    switchDirectoryFresh: '使用空数据',
    switchDirectoryFreshHint: '直接切换到新目录，若没有数据库则创建新的空数据。',
    languageTitle: '语言',
    languageDescription: '切换当前应用界面的显示语言。',
    languageLabel: '显示语言',
    languageOptions: {
      'zh-CN': {
        label: '简体中文',
        hint: '界面将以中文显示',
      },
      'en-US': {
        label: 'English',
        hint: 'Use English for the interface',
      },
    },
    aboutTitle: '项目资料',
    aboutDescription: '当前桌面应用的基础元数据。',
    projectName: '项目名称',
    version: '版本',
    releaseDate: '发布时间',
    createdAtUnknown: '创建时间未知',
    createdAt: (value: string) => `创建于 ${value}`,
    unknownError: '发生了未知错误，请稍后重试。',
  },
  'en-US': {
    setting: 'Settings',
    remainingCount: (count: number) => `${count} remaining`,
    totalCount: (count: number) => `${count} total`,
    quickAddPlaceholder: 'Quick add a reminder and press Enter',
    loading: 'Loading...',
    emptyTodos: 'No todos yet. Create your first one.',
    untitledTodo: 'Untitled Todo',
    noSummary: 'No notes',
    blankTitle: 'Select a todo',
    blankDescription: 'Pick an item on the left to view details or start editing.',
    exitEdit: 'Done',
    edit: 'Edit',
    delete: 'Delete',
    titlePlaceholder: 'Title',
    summaryPlaceholder: 'Add a note',
    markdown: 'Markdown',
    markdownPlaceholder: '# What do you want to do today?\n\n- Task one\n- Task two',
    newTodoTitle: 'New Todo',
    saveStatus: {
      saved: 'Saved',
      typing: 'Typing...',
      saving: 'Saving...',
      failed: 'Save failed',
    },
    settingsTitle: 'Settings',
    close: 'Close',
    tabs: {
      data: 'Data',
      language: 'Language',
      about: 'About',
    },
    dataTitle: 'Data Directory',
    dataDescription: 'Manage where the local SQLite database is stored.',
    directoryLabel: 'Current directory',
    chooseDirectory: 'Choose Directory',
    cancel: 'Cancel',
    saveDirectory: 'Save Directory',
    switchDirectoryTitle: 'Switch Data Directory',
    switchDirectoryDescription: 'Choose how to handle data when switching to the new directory.',
    switchDirectoryCopy: 'Migrate Existing Data',
    switchDirectoryCopyHint: 'Copy the current todo.db into the new directory before switching.',
    switchDirectoryFresh: 'Use Empty Data',
    switchDirectoryFreshHint: 'Switch directly to the new directory and create a fresh database if needed.',
    languageTitle: 'Language',
    languageDescription: 'Choose the display language for this app.',
    languageLabel: 'Display language',
    languageOptions: {
      'zh-CN': {
        label: '简体中文',
        hint: 'Show the interface in Simplified Chinese',
      },
      'en-US': {
        label: 'English',
        hint: 'Show the interface in English',
      },
    },
    aboutTitle: 'Project Info',
    aboutDescription: 'Basic metadata for the current desktop app.',
    projectName: 'Project Name',
    version: 'Version',
    releaseDate: 'Release Date',
    createdAtUnknown: 'Created time unavailable',
    createdAt: (value: string) => `Created ${value}`,
    unknownError: 'An unknown error occurred. Please try again later.',
  },
} satisfies Record<Locale, Record<string, unknown>>;

const emptyDraft = (): TodoDraft => ({
  title: '',
  summary: '',
  detailMarkdown: '',
  isCompleted: false,
});

function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TodoDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageInput, setStorageInput] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [isEditing, setIsEditing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('data');
  const [isDirectoryConfirmOpen, setIsDirectoryConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const autosaveTokenRef = useRef(0);

  const locale: Locale = config?.language ?? 'zh-CN';
  const copy = messages[locale];

  useEffect(() => {
    void loadBootstrap();
  }, []);

  const selectedTodo = useMemo(
    () => todos.find((item) => item.id === selectedId) ?? null,
    [selectedId, todos],
  );

  const draftSignature = useMemo(() => JSON.stringify(draft), [draft]);
  const selectedSignature = useMemo(
    () => (selectedTodo ? JSON.stringify(fromTodo(selectedTodo)) : ''),
    [selectedTodo],
  );

  const detailHTML = useMemo(() => {
    const source = isEditing ? draft.detailMarkdown : selectedTodo?.detailMarkdown;
    const html = marked.parse(source || '', { breaks: true }) as string;
    return DOMPurify.sanitize(html);
  }, [draft.detailMarkdown, isEditing, selectedTodo?.detailMarkdown]);

  useEffect(() => {
    if (!isEditing || !selectedTodo) {
      setSaveStatus('saved');
      return;
    }

    if (draftSignature === selectedSignature) {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('typing');
    const token = autosaveTokenRef.current + 1;
    autosaveTokenRef.current = token;

    const timer = window.setTimeout(() => {
      void persistDraft(token);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [draftSignature, isEditing, selectedSignature, selectedTodo]);

  async function loadBootstrap() {
    try {
      setLoading(true);
      const data = await backend.getBootstrap();
      applyBootstrap(data);
      setError('');
    } catch (err) {
      setError(readError(err, copy.unknownError as string));
    } finally {
      setLoading(false);
    }
  }

  function applyBootstrap(data: BootstrapResponse) {
    setConfig(data.config);
    setStorageInput(data.config.storageDir);
    setTodos(data.todos);

    const first = data.todos[0] ?? null;
    if (!first) {
      setSelectedId(null);
      setDraft(emptyDraft());
      setIsEditing(false);
      return;
    }

    const active = data.todos.find((item) => item.id === selectedId) ?? first;
    setSelectedId(active.id);
    setDraft(fromTodo(active));
  }

  function selectTodo(todo: Todo) {
    setSelectedId(todo.id);
    setDraft(fromTodo(todo));
    setIsEditing(false);
    setSaveStatus('saved');
    setError('');
  }

  async function handleCreateTodo(title?: string) {
    const nextTitle = (title ?? (copy.newTodoTitle as string)).trim() || (copy.newTodoTitle as string);

    try {
      setSaving(true);
      const created = await backend.createTodo({
        title: nextTitle,
        summary: '',
        detailMarkdown: '',
      });
      const nextTodos = sortTodos([created, ...todos]);
      setTodos(nextTodos);
      setSelectedId(created.id);
      setDraft(fromTodo(created));
      setQuickTitle('');
      setIsEditing(true);
      setSaveStatus('saved');
      setError('');
    } catch (err) {
      setError(readError(err, copy.unknownError as string));
    } finally {
      setSaving(false);
    }
  }

  async function persistDraft(token?: number) {
    if (!selectedId) {
      return;
    }

    if (token !== undefined && token !== autosaveTokenRef.current) {
      return;
    }

    try {
      setSaving(true);
      setSaveStatus('saving');
      const updated = await backend.updateTodo({
        id: selectedId,
        ...draft,
      });
      if (token !== undefined && token !== autosaveTokenRef.current) {
        return;
      }
      setTodos((current) => sortTodos(current.map((item) => (item.id === updated.id ? updated : item))));
      setDraft(fromTodo(updated));
      setSaveStatus('saved');
      setError('');
    } catch (err) {
      setSaveStatus('failed');
      setError(readError(err, copy.unknownError as string));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTodo() {
    if (!selectedId) {
      return;
    }

    try {
      setSaving(true);
      await backend.deleteTodo(selectedId);
      const nextTodos = todos.filter((item) => item.id !== selectedId);
      setTodos(nextTodos);
      const next = nextTodos[0] ?? null;
      setSelectedId(next?.id ?? null);
      setDraft(next ? fromTodo(next) : emptyDraft());
      setIsEditing(false);
      setSaveStatus('saved');
      setError('');
    } catch (err) {
      setError(readError(err, copy.unknownError as string));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleCompleted(todo: Todo) {
    try {
      const updated = await backend.toggleCompleted(todo.id);
      setTodos((current) => sortTodos(current.map((item) => (item.id === updated.id ? updated : item))));
      if (selectedId === updated.id) {
        setDraft(fromTodo(updated));
      }
      setSaveStatus('saved');
      setError('');
    } catch (err) {
      setError(readError(err, copy.unknownError as string));
    }
  }

  async function handleConfirmStorageDir(mode: DirectorySwitchMode) {
    try {
      setSaving(true);
      const data = await backend.updateStorageDirectory(storageInput.trim(), mode === 'copy');
      applyBootstrap(data);
      setError('');
      setIsDirectoryConfirmOpen(false);
      setIsSettingsOpen(false);
    } catch (err) {
      setError(readError(err, copy.unknownError as string));
    } finally {
      setSaving(false);
    }
  }

  function handleRequestStorageDirChange() {
    const nextPath = storageInput.trim();
    if (!nextPath) {
      return;
    }
    if (nextPath === config?.storageDir) {
      return;
    }
    setIsDirectoryConfirmOpen(true);
  }

  async function handleBrowseStorageDir() {
    try {
      setSaving(true);
      const selected = await backend.selectStorageDirectory();
      if (!selected) {
        return;
      }
      setStorageInput(selected);
      setError('');
    } catch (err) {
      setError(readError(err, copy.unknownError as string));
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeLanguage(language: Locale) {
    if (language === locale) {
      return;
    }

    try {
      setSaving(true);
      const data = await backend.updateLanguage(language);
      applyBootstrap(data);
      setError('');
    } catch (err) {
      setError(readError(err, copy.unknownError as string));
    } finally {
      setSaving(false);
    }
  }

  function openSettings(tab: SettingsTab) {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  }

  return (
    <>
      <div className="shell">
        <aside className="sidebar">
          <div className="sidebar__topbar">
            <div className="sidebar__meta">
              <span>{copy.remainingCount(todos.filter((item) => !item.isCompleted).length)}</span>
              <span>{copy.totalCount(todos.length)}</span>
            </div>
            <button type="button" className="topbar-link" onClick={() => openSettings('data')} title={copy.setting}>
              {copy.setting}
            </button>
          </div>

          <div className="quick-entry">
            <span className="quick-entry__plus">+</span>
            <input
              value={quickTitle}
              onChange={(event) => setQuickTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && quickTitle.trim()) {
                  void handleCreateTodo(quickTitle);
                }
              }}
              placeholder={copy.quickAddPlaceholder}
            />
          </div>

          <div className="todo-list">
            {loading ? <p className="empty-state">{copy.loading}</p> : null}
            {!loading && todos.length === 0 ? <p className="empty-state">{copy.emptyTodos}</p> : null}
            {todos.map((todo) => (
              <button
                key={todo.id}
                type="button"
                className={`todo-row ${selectedId === todo.id ? 'is-active' : ''} ${todo.isCompleted ? 'is-completed' : ''}`}
                onClick={() => selectTodo(todo)}
              >
                <span
                  className={`check-circle ${todo.isCompleted ? 'is-completed' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleToggleCompleted(todo);
                  }}
                >
                  {todo.isCompleted ? '✓' : ''}
                </span>
                <span className="todo-row__content">
                  <strong>{todo.title || copy.untitledTodo}</strong>
                  <span>{todo.summary || copy.noSummary}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className="detail-panel">
          {error ? <div className="error-banner">{error}</div> : null}

          {!selectedTodo ? (
            <div className="blank-state">
              <h2>{copy.blankTitle}</h2>
              <p>{copy.blankDescription}</p>
            </div>
          ) : (
            <>
              <div className="detail-toolbar">
                <span className="created-at">{formatCreatedAt(selectedTodo.createdAt, locale, copy)}</span>
                <div className="detail-toolbar__actions">
                  {isEditing ? (
                    <button type="button" className="topbar-link" onClick={() => setIsEditing(false)}>
                      {copy.exitEdit}
                    </button>
                  ) : (
                    <button type="button" className="topbar-link" onClick={() => setIsEditing(true)}>
                      {copy.edit}
                    </button>
                  )}
                  <button type="button" className="topbar-link" onClick={() => void handleDeleteTodo()} disabled={saving}>
                    {copy.delete}
                  </button>
                </div>
              </div>

              {isEditing ? (
                <>
                  <section className="detail-section">
                    <input
                      className="title-input"
                      value={draft.title}
                      onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                      placeholder={copy.titlePlaceholder}
                    />
                    <textarea
                      className="summary-input"
                      rows={2}
                      value={draft.summary}
                      onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
                      placeholder={copy.summaryPlaceholder}
                    />
                  </section>

                  <section className="detail-section preview-section">
                    <div className="detail-section__header">
                      <h3>{copy.markdown}</h3>
                      <span className="save-hint">{copy.saveStatus[saveStatus]}</span>
                    </div>
                    <textarea
                      className="detail-textarea"
                      rows={18}
                      value={draft.detailMarkdown}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          detailMarkdown: event.target.value,
                        }))
                      }
                      placeholder={copy.markdownPlaceholder}
                    />
                  </section>
                </>
              ) : (
                <>
                  <section className="detail-section">
                    <div className="detail-static">
                      <h1 className="detail-title">{selectedTodo.title || copy.untitledTodo}</h1>
                      {selectedTodo.summary ? <p className="detail-summary">{selectedTodo.summary}</p> : null}
                    </div>
                  </section>

                  <section className="detail-section preview-section">
                    <div className="preview-content" dangerouslySetInnerHTML={{ __html: detailHTML }} />
                  </section>
                </>
              )}
            </>
          )}
        </main>
      </div>

      {isSettingsOpen ? (
        <div className="modal-backdrop" onClick={() => setIsSettingsOpen(false)}>
          <div className="settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="settings-modal__header">
              <h2>{copy.settingsTitle}</h2>
              <button type="button" className="icon-button" onClick={() => setIsSettingsOpen(false)} aria-label={copy.close}>
                ×
              </button>
            </div>

            <div className="settings-tabs">
              {(['data', 'language', 'about'] as SettingsTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`settings-tab ${settingsTab === tab ? 'is-active' : ''}`}
                  onClick={() => setSettingsTab(tab)}
                >
                  {copy.tabs[tab]}
                </button>
              ))}
            </div>

            <div className="settings-panel">
              {settingsTab === 'data' ? (
                <section className="settings-pane">
                  <div className="settings-pane__header">
                    <h3>{copy.dataTitle}</h3>
                    <p>{copy.dataDescription}</p>
                  </div>
                  <label className="settings-field">
                    <span>{copy.directoryLabel}</span>
                    <div className="settings-path-row">
                      <div className="settings-path-value" title={storageInput}>
                        {storageInput || copy.loading}
                      </div>
                      <button
                        type="button"
                        className="topbar-link"
                        onClick={() => void handleBrowseStorageDir()}
                        disabled={saving}
                      >
                        {copy.chooseDirectory}
                      </button>
                    </div>
                  </label>
                  <div className="settings-meta">{config?.dbPath ?? copy.loading}</div>
                  <div className="settings-actions">
                    <button type="button" className="topbar-link" onClick={() => setIsSettingsOpen(false)}>
                      {copy.cancel}
                    </button>
                    <button
                      type="button"
                      className="topbar-link"
                      onClick={handleRequestStorageDirChange}
                      disabled={saving || !storageInput.trim() || storageInput.trim() === config?.storageDir}
                    >
                      {copy.saveDirectory}
                    </button>
                  </div>
                </section>
              ) : null}

              {settingsTab === 'language' ? (
                <section className="settings-pane">
                  <div className="settings-pane__header">
                    <h3>{copy.languageTitle}</h3>
                    <p>{copy.languageDescription}</p>
                  </div>
                  <div className="language-options" role="radiogroup" aria-label={copy.languageLabel}>
                    {(['zh-CN', 'en-US'] as Locale[]).map((language) => (
                      <button
                        key={language}
                        type="button"
                        className={`language-option ${locale === language ? 'is-active' : ''}`}
                        onClick={() => void handleChangeLanguage(language)}
                        disabled={saving}
                      >
                        <strong>{copy.languageOptions[language].label}</strong>
                        <span>{copy.languageOptions[language].hint}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {settingsTab === 'about' ? (
                <section className="settings-pane">
                  <div className="settings-pane__header">
                    <h3>{copy.aboutTitle}</h3>
                    <p>{copy.aboutDescription}</p>
                  </div>
                  <div className="about-grid">
                    <div className="about-item">
                      <span>{copy.projectName}</span>
                      <strong>{APP_INFO.name}</strong>
                    </div>
                    <div className="about-item">
                      <span>{copy.version}</span>
                      <strong>{APP_INFO.version}</strong>
                    </div>
                    <div className="about-item">
                      <span>{copy.releaseDate}</span>
                      <strong>{APP_INFO.releaseDate}</strong>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>

            {isDirectoryConfirmOpen ? (
              <div className="settings-confirm-overlay">
                <div className="settings-confirm-card">
                  <div className="settings-pane__header">
                    <h3>{copy.switchDirectoryTitle}</h3>
                    <p>{copy.switchDirectoryDescription}</p>
                  </div>
                  <div className="language-options">
                    <button
                      type="button"
                      className="language-option"
                      onClick={() => void handleConfirmStorageDir('copy')}
                      disabled={saving}
                    >
                      <strong>{copy.switchDirectoryCopy}</strong>
                      <span>{copy.switchDirectoryCopyHint}</span>
                    </button>
                    <button
                      type="button"
                      className="language-option"
                      onClick={() => void handleConfirmStorageDir('fresh')}
                      disabled={saving}
                    >
                      <strong>{copy.switchDirectoryFresh}</strong>
                      <span>{copy.switchDirectoryFreshHint}</span>
                    </button>
                  </div>
                  <div className="settings-actions">
                    <button
                      type="button"
                      className="topbar-link"
                      onClick={() => setIsDirectoryConfirmOpen(false)}
                      disabled={saving}
                    >
                      {copy.cancel}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function fromTodo(todo: Todo): TodoDraft {
  return {
    title: todo.title,
    summary: todo.summary,
    detailMarkdown: todo.detailMarkdown,
    isCompleted: todo.isCompleted,
  };
}

function sortTodos(items: Todo[]) {
  return [...items].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function readError(err: unknown, fallback: string) {
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

function formatCreatedAt(
  value: string,
  locale: Locale,
  copy: (typeof messages)[Locale],
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return copy.createdAtUnknown;
  }

  const formatted = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  return copy.createdAt(formatted);
}

export default App;
