import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useEffect, useMemo, useRef, useState } from 'react';
import { backend } from './lib/wails';
import type { AppConfig, BootstrapResponse, Todo, TodoDraft, TodoSubitem } from './types';

const APP_INFO = {
  name: 'Mine ToDo',
  version: '1.0.0',
  releaseDate: '2026-04-30',
};

type Locale = 'zh-CN' | 'en-US';
type SettingsTab = 'data' | 'language' | 'about';
type SaveStatus = 'saved' | 'typing' | 'saving' | 'failed';
type DirectorySwitchMode = 'copy' | 'fresh';
type PendingSubitem = { id: string; content: string };
type CalendarView = 'month' | 'week';

const messages = {
  'zh-CN': {
    setting: '设置',
    remainingCount: (count: number) => `${count} 项未完成`,
    totalCount: (count: number) => `${count} 项全部`,
    quickAddPlaceholder: '快速添加待办，回车创建',
    loading: '正在加载...',
    emptyTodos: '还没有待办，先创建第一条。',
    untitledTodo: '未命名待办',
    noSummary: '无备注',
    blankTitle: '选择一个待办',
    blankDescription: '左侧选中后，在右侧查看详情或进入编辑。',
    exitEdit: '退出编辑',
    edit: '编辑',
    delete: '删除',
    confirmDeleteTitle: '确认删除',
    confirmDeleteDescription: '删除后将无法恢复',
    confirmDeleteAction: '确认删除',
    titlePlaceholder: '标题',
    summaryPlaceholder: '添加备注',
    dueDateLabel: '日期',
    dueDateNone: '未安排日期',
    clearDate: '清空日期',
    chooseDate: '选择日期',
    markdown: 'Markdown',
    markdownPlaceholder: '# 今天要做什么？\n\n- 任务一\n- 任务二',
    subitemsTitle: '子项代办',
    addSubitem: '添加子项',
    deleteSelectedSubitems: '删除选中',
    subitemPlaceholder: '输入子项内容后按回车',
    emptySubitems: '暂无子项',
    calendarEntryTitle: '日历看板',
    calendarEntryDescription: '查看月视图和周视图',
    calendarTitle: '日历看板',
    monthView: '月视图',
    weekView: '周视图',
    today: '今天',
    noScheduledTodos: '当日没有待办内容',
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
    confirmDeleteTitle: 'Confirm Delete',
    confirmDeleteDescription: 'This todo cannot be restored after deletion.',
    confirmDeleteAction: 'Delete Todo',
    titlePlaceholder: 'Title',
    summaryPlaceholder: 'Add a note',
    dueDateLabel: 'Date',
    dueDateNone: 'No date scheduled',
    clearDate: 'Clear date',
    chooseDate: 'Choose date',
    markdown: 'Markdown',
    markdownPlaceholder: '# What do you want to do today?\n\n- Task one\n- Task two',
    subitemsTitle: 'Subtasks',
    addSubitem: 'Add Subtask',
    deleteSelectedSubitems: 'Delete Selected',
    subitemPlaceholder: 'Type a subtask and press Enter',
    emptySubitems: 'No subtasks yet.',
    calendarEntryTitle: 'Calendar Board',
    calendarEntryDescription: 'View month and week layouts',
    calendarTitle: 'Calendar Board',
    monthView: 'Month',
    weekView: 'Week',
    today: 'Today',
    noScheduledTodos: 'No todos scheduled for this day.',
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
  dueDate: '',
  subitems: [],
});

function persistableDraft(draft: TodoDraft) {
  return {
    title: draft.title,
    summary: draft.summary,
    detailMarkdown: draft.detailMarkdown,
    isCompleted: draft.isCompleted,
    dueDate: draft.dueDate,
  };
}

function createPendingSubitem(): PendingSubitem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content: '',
  };
}

function startOfDay(value: Date) {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(value: Date, days: number) {
  const copy = new Date(value);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfWeek(value: Date) {
  const copy = startOfDay(value);
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(copy, offset);
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function dateKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const key = value.slice(0, 10);
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function monthGridDates(value: Date) {
  const firstDay = startOfMonth(value);
  const gridStart = startOfWeek(firstDay);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function monthCalendarCells(value: Date) {
  const firstDay = startOfMonth(value);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const lastDay = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= lastDay; day += 1) {
    cells.push(new Date(value.getFullYear(), value.getMonth(), day));
  }

  return cells;
}

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
  const [isDueDatePickerOpen, setIsDueDatePickerOpen] = useState(false);
  const [dueDatePickerCursor, setDueDatePickerCursor] = useState(() => startOfMonth(new Date()));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [calendarCursor, setCalendarCursor] = useState(() => startOfDay(new Date()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => startOfDay(new Date()));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('data');
  const [isDirectoryConfirmOpen, setIsDirectoryConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedSubitemIds, setSelectedSubitemIds] = useState<string[]>([]);
  const [pendingSubitems, setPendingSubitems] = useState<PendingSubitem[]>([]);
  const [editingSubitemId, setEditingSubitemId] = useState<string | null>(null);
  const [editingSubitemContent, setEditingSubitemContent] = useState('');
  const [error, setError] = useState('');
  const autosaveTokenRef = useRef(0);
  const todoItemRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingScrollTodoIdRef = useRef<string | null>(null);

  const locale: Locale = config?.language ?? 'zh-CN';
  const copy = messages[locale];

  useEffect(() => {
    void loadBootstrap();
  }, []);

  const selectedTodo = useMemo(
    () => todos.find((item) => item.id === selectedId) ?? null,
    [selectedId, todos],
  );

  const draftSignature = useMemo(() => JSON.stringify(persistableDraft(draft)), [draft]);
  const selectedSignature = useMemo(
    () => (selectedTodo ? JSON.stringify(persistableDraft(fromTodo(selectedTodo))) : ''),
    [selectedTodo],
  );

  const detailHTML = useMemo(() => {
    const source = isEditing ? draft.detailMarkdown : selectedTodo?.detailMarkdown;
    const html = marked.parse(source || '', { breaks: true }) as string;
    return DOMPurify.sanitize(html);
  }, [draft.detailMarkdown, isEditing, selectedTodo?.detailMarkdown]);

  const scheduledTodos = useMemo(
    () => todos
      .map((todo) => {
        const date = parseDateKey(todo.dueDate);
        return date ? { todo, date } : null;
      })
      .filter((item): item is { todo: Todo; date: Date } => item !== null),
    [todos],
  );

  const calendarDays = useMemo(() => {
    if (calendarView === 'month') {
      return monthGridDates(calendarCursor);
    }

    const start = startOfWeek(calendarCursor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [calendarCursor, calendarView]);

  const monthCells = useMemo(() => monthCalendarCells(calendarCursor), [calendarCursor]);

  const todosByDate = useMemo(() => {
    const grouped = new Map<string, Todo[]>();
    for (const entry of scheduledTodos) {
      const key = dateKey(entry.date);
      const existing = grouped.get(key) ?? [];
      existing.push(entry.todo);
      grouped.set(key, existing);
    }
    return grouped;
  }, [scheduledTodos]);

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

  function clearSubitemEditingState() {
    setSelectedSubitemIds([]);
    setPendingSubitems([]);
    setEditingSubitemId(null);
    setEditingSubitemContent('');
  }

  function syncUpdatedTodo(updated: Todo, preserveEditingFields = false) {
    setTodos((current) => sortTodos(current.map((item) => (item.id === updated.id ? updated : item))));

    if (selectedId !== updated.id) {
      return;
    }

    if (preserveEditingFields && isEditing) {
      setDraft((current) => ({
        ...current,
        subitems: updated.subitems,
      }));
      return;
    }

    setDraft(fromTodo(updated));
  }

  function exitEditMode() {
    clearSubitemEditingState();
    setIsEditing(false);
    setSaveStatus('saved');
  }

  function applyBootstrap(data: BootstrapResponse) {
    setConfig(data.config);
    setStorageInput(data.config.storageDir);
    setTodos(data.todos);
    clearSubitemEditingState();

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
    clearSubitemEditingState();
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
      clearSubitemEditingState();
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
      syncUpdatedTodo(updated);
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
      clearSubitemEditingState();
      setIsEditing(false);
      setIsDeleteConfirmOpen(false);
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
      syncUpdatedTodo(updated, true);
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

  function requestDeleteTodo() {
    if (!selectedId) {
      return;
    }
    setIsDeleteConfirmOpen(true);
  }

  function openCalendarBoard() {
    const today = startOfDay(new Date());
    setCalendarCursor(today);
    setSelectedCalendarDate(today);
    setCalendarView('month');
    setIsCalendarOpen(true);
    setIsEditing(false);
    clearSubitemEditingState();
  }

  function shiftCalendar(offset: number) {
    setCalendarCursor((current) =>
      calendarView === 'month'
        ? new Date(current.getFullYear(), current.getMonth() + offset, 1)
        : addDays(current, offset * 7),
    );
  }

  function openTodoFromCalendar(todo: Todo) {
    pendingScrollTodoIdRef.current = todo.id;
    selectTodo(todo);
    setIsCalendarOpen(false);
  }

  function openDueDatePicker() {
    const seedDate = parseDateKey(draft.dueDate) ?? startOfDay(new Date());
    setDueDatePickerCursor(startOfMonth(seedDate));
    setIsDueDatePickerOpen(true);
  }

  function applyDueDate(value: string) {
    setDraft((current) => ({ ...current, dueDate: value }));
    setIsDueDatePickerOpen(false);
  }

  function handleAddSubitemInput() {
    setPendingSubitems((current) => [...current, createPendingSubitem()]);
  }

  function handlePendingSubitemChange(id: string, content: string) {
    setPendingSubitems((current) =>
      current.map((item) => (item.id === id ? { ...item, content } : item)),
    );
  }

  function removePendingSubitem(id: string) {
    setPendingSubitems((current) => current.filter((item) => item.id !== id));
  }

  function startEditingSubitem(subitem: TodoSubitem) {
    setEditingSubitemId(subitem.id);
    setEditingSubitemContent(subitem.content);
  }

  function cancelEditingSubitem() {
    setEditingSubitemId(null);
    setEditingSubitemContent('');
  }

  async function commitPendingSubitem(id: string) {
    const target = pendingSubitems.find((item) => item.id === id);
    if (!target || !selectedId) {
      return;
    }

    const content = target.content.trim();
    if (!content) {
      removePendingSubitem(id);
      return;
    }

    removePendingSubitem(id);

    try {
      setSaving(true);
      const updated = await backend.createSubitem({
        todoId: selectedId,
        content,
      });
      syncUpdatedTodo(updated, true);
      setError('');
    } catch (err) {
      setPendingSubitems((current) => [...current, target]);
      setError(readError(err, copy.unknownError as string));
    } finally {
      setSaving(false);
    }
  }

  async function commitEditingSubitem() {
    if (!selectedId || !editingSubitemId) {
      return;
    }

    const original = draft.subitems.find((item) => item.id === editingSubitemId);
    if (!original) {
      cancelEditingSubitem();
      return;
    }

    const content = editingSubitemContent.trim();
    if (!content || content === original.content) {
      cancelEditingSubitem();
      return;
    }

    try {
      setSaving(true);
      const updated = await backend.updateSubitem({
        todoId: selectedId,
        id: editingSubitemId,
        content,
      });
      cancelEditingSubitem();
      syncUpdatedTodo(updated, true);
      setError('');
    } catch (err) {
      setError(readError(err, copy.unknownError as string));
    } finally {
      setSaving(false);
    }
  }

  function toggleSubitemSelection(id: string) {
    setSelectedSubitemIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function handleDeleteSelectedSubitems() {
    if (!selectedId || selectedSubitemIds.length === 0) {
      return;
    }

    try {
      setSaving(true);
      const updated = await backend.deleteSubitems({
        todoId: selectedId,
        ids: selectedSubitemIds,
      });
      setSelectedSubitemIds([]);
      syncUpdatedTodo(updated, true);
      setError('');
    } catch (err) {
      setError(readError(err, copy.unknownError as string));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSubitemCompleted(subitem: TodoSubitem) {
    if (!selectedId) {
      return;
    }

    try {
      setSaving(true);
      const updated = await backend.toggleSubitemCompleted({
        todoId: selectedId,
        id: subitem.id,
      });
      syncUpdatedTodo(updated, true);
      setError('');
    } catch (err) {
      setError(readError(err, copy.unknownError as string));
    } finally {
      setSaving(false);
    }
  }

  const visibleSubitems = isEditing ? draft.subitems : selectedTodo?.subitems ?? [];
  const dueDatePickerMonthCells = useMemo(() => monthCalendarCells(dueDatePickerCursor), [dueDatePickerCursor]);
  const selectedDateTodos = useMemo(
    () => todosByDate.get(dateKey(selectedCalendarDate)) ?? [],
    [selectedCalendarDate, todosByDate],
  );
  const calendarTitle = useMemo(() => {
    if (calendarView === 'month') {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
      }).format(calendarCursor);
    }

    const start = calendarDays[0];
    const end = calendarDays[calendarDays.length - 1];
    const format = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    });
    return `${format.format(start)} - ${format.format(end)}`;
  }, [calendarCursor, calendarDays, calendarView, locale]);
  const selectedDateTitle = useMemo(
    () => new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(selectedCalendarDate),
    [locale, selectedCalendarDate],
  );

  const weekdayLabels = useMemo(() => {
    const start = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, index) =>
      new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(addDays(start, index)),
    );
  }, [locale]);

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

          <button type="button" className={`calendar-entry ${isCalendarOpen ? 'is-active' : ''}`} onClick={openCalendarBoard}>
            <span className="calendar-entry__icon">▦</span>
            <span className="calendar-entry__copy">
              <strong>{copy.calendarEntryTitle}</strong>
              <span>{copy.calendarEntryDescription}</span>
            </span>
          </button>

          <div className="todo-list">
            {loading ? <p className="empty-state">{copy.loading}</p> : null}
            {!loading && todos.length === 0 ? <p className="empty-state">{copy.emptyTodos}</p> : null}
            {todos.map((todo) => (
              <button
                key={todo.id}
                ref={(node) => {
                  if (node) {
                    todoItemRefs.current.set(todo.id, node);
                    return;
                  }
                  todoItemRefs.current.delete(todo.id);
                }}
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
                  {isEditing ? <span className="save-hint">{copy.saveStatus[saveStatus]}</span> : null}
                  {isEditing ? (
                    <button type="button" className="topbar-link" onClick={exitEditMode}>
                      {copy.exitEdit}
                    </button>
                  ) : (
                    <button type="button" className="topbar-link" onClick={() => setIsEditing(true)}>
                      {copy.edit}
                    </button>
                  )}
                  <button type="button" className="topbar-link" onClick={requestDeleteTodo} disabled={saving}>
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
                    <div className="detail-date-field">
                      <span>{copy.dueDateLabel}</span>
                      <div className="detail-date-picker-row">
                        <button
                          type="button"
                          className="detail-date-picker"
                          onClick={openDueDatePicker}
                        >
                          <span className={`detail-date-picker__value ${draft.dueDate ? 'has-value' : ''}`}>
                            <strong>{draft.dueDate ? formatDueDate(draft.dueDate, locale) : copy.dueDateNone}</strong>
                          </span>
                          <span className="detail-date-picker__icon">▾</span>
                        </button>
                        {draft.dueDate ? (
                          <button
                            type="button"
                            className="detail-date-picker__clear"
                            onClick={() => setDraft((current) => ({ ...current, dueDate: '' }))}
                            aria-label={copy.clearDate}
                            title={copy.clearDate}
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </section>

                  <section className="detail-section">
                    <div className="detail-section__header">
                      <h3>{copy.markdown}</h3>
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

                  <section className="detail-section preview-section">
                    <div className="detail-section__header">
                      <h3>{copy.subitemsTitle}</h3>
                      <div className="subitems-toolbar">
                        <button
                          type="button"
                          className="topbar-link"
                          onClick={() => void handleDeleteSelectedSubitems()}
                          disabled={saving || selectedSubitemIds.length === 0}
                        >
                          {copy.deleteSelectedSubitems}
                        </button>
                        <button
                          type="button"
                          className="subitem-add-button"
                          onClick={handleAddSubitemInput}
                          disabled={saving}
                          aria-label={copy.addSubitem}
                          title={copy.addSubitem}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="subitems-list">
                      {visibleSubitems.length === 0 && pendingSubitems.length === 0 ? (
                        <p className="subitems-empty">{copy.emptySubitems}</p>
                      ) : null}

                      {visibleSubitems.map((subitem) => {
                        const isSelected = selectedSubitemIds.includes(subitem.id);
                        const isEditingSubitem = editingSubitemId === subitem.id;

                        return (
                          <label
                            key={subitem.id}
                            className={`subitem-row is-editing ${isSelected ? 'is-selected' : ''} ${subitem.isCompleted ? 'is-completed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSubitemSelection(subitem.id)}
                            />
                            <span className="subitem-checkbox">{isSelected ? '✓' : ''}</span>
                            {isEditingSubitem ? (
                              <input
                                className="subitem-input"
                                value={editingSubitemContent}
                                onChange={(event) => setEditingSubitemContent(event.target.value)}
                                onBlur={() => void commitEditingSubitem()}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void commitEditingSubitem();
                                  }
                                  if (event.key === 'Escape') {
                                    cancelEditingSubitem();
                                  }
                                }}
                                autoFocus
                              />
                            ) : (
                              <button
                                type="button"
                                className="subitem-content-button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  startEditingSubitem(subitem);
                                }}
                              >
                                <span className="subitem-content">{subitem.content}</span>
                              </button>
                            )}
                          </label>
                        );
                      })}

                      {pendingSubitems.map((item, index) => (
                        <div key={item.id} className="subitem-row is-pending">
                          <span className="subitem-checkbox is-pending" />
                          <input
                            className="subitem-input"
                            value={item.content}
                            onChange={(event) => handlePendingSubitemChange(item.id, event.target.value)}
                            onBlur={() => void commitPendingSubitem(item.id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                void commitPendingSubitem(item.id);
                              }
                              if (event.key === 'Escape') {
                                removePendingSubitem(item.id);
                              }
                            }}
                            placeholder={copy.subitemPlaceholder}
                            autoFocus={index === pendingSubitems.length - 1}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <section className="detail-section">
                    <div className="detail-static">
                      <h1 className="detail-title">{selectedTodo.title || copy.untitledTodo}</h1>
                      {selectedTodo.summary ? <p className="detail-summary">{selectedTodo.summary}</p> : null}
                      <div className="detail-date-display">
                        <span>{copy.dueDateLabel}</span>
                        <strong>{selectedTodo.dueDate ? formatDueDate(selectedTodo.dueDate, locale) : copy.dueDateNone}</strong>
                      </div>
                    </div>
                  </section>

                  <section className="detail-section">
                    <div className="preview-content" dangerouslySetInnerHTML={{ __html: detailHTML }} />
                  </section>

                  <section className="detail-section preview-section">
                    <div className="detail-section__header">
                      <h3>{copy.subitemsTitle}</h3>
                    </div>

                    <div className="subitems-list">
                      {visibleSubitems.length === 0 ? <p className="subitems-empty">{copy.emptySubitems}</p> : null}

                      {visibleSubitems.map((subitem) => (
                        <button
                          key={subitem.id}
                          type="button"
                          className={`subitem-row is-view ${subitem.isCompleted ? 'is-completed' : ''}`}
                          onClick={() => void handleToggleSubitemCompleted(subitem)}
                          disabled={saving}
                        >
                          <span className={`subitem-checkbox ${subitem.isCompleted ? 'is-checked' : ''}`}>
                            {subitem.isCompleted ? '✓' : ''}
                          </span>
                          <span className="subitem-content">{subitem.content}</span>
                        </button>
                      ))}
                    </div>
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

      {isDeleteConfirmOpen ? (
        <div className="modal-backdrop" onClick={() => setIsDeleteConfirmOpen(false)}>
          <div className="settings-confirm-card delete-confirm-card" onClick={(event) => event.stopPropagation()}>
            <div className="settings-pane__header">
              <h3>{copy.confirmDeleteTitle}</h3>
              <p>{copy.confirmDeleteDescription}</p>
            </div>
            <div className="settings-actions delete-confirm-actions">
              <button
                type="button"
                className="dialog-button dialog-button--secondary"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={saving}
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                className="dialog-button dialog-button--danger"
                onClick={() => void handleDeleteTodo()}
                disabled={saving}
              >
                {copy.confirmDeleteAction}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDueDatePickerOpen ? (
        <div className="modal-backdrop" onClick={() => setIsDueDatePickerOpen(false)}>
          <div className="due-date-modal" onClick={(event) => event.stopPropagation()}>
            <div className="due-date-modal__header">
              <div className="calendar-toolbar__title">
                <h2>{copy.chooseDate}</h2>
                <span className="created-at">
                  {new Intl.DateTimeFormat(locale, {
                    year: 'numeric',
                    month: 'long',
                  }).format(dueDatePickerCursor)}
                </span>
              </div>
              <div className="calendar-toolbar__actions">
                <button
                  type="button"
                  className="topbar-link"
                  onClick={() => setDueDatePickerCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="topbar-link"
                  onClick={() => setDueDatePickerCursor(startOfMonth(new Date()))}
                >
                  {copy.today}
                </button>
                <button
                  type="button"
                  className="topbar-link"
                  onClick={() => setDueDatePickerCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                >
                  ›
                </button>
              </div>
            </div>

            <div className="due-date-calendar">
              <div className="calendar-grid calendar-grid--header">
                {weekdayLabels.map((label) => (
                  <div key={label} className="calendar-cell calendar-cell--header">
                    {label}
                  </div>
                ))}
              </div>

              <div className="calendar-grid calendar-grid--body is-month compact">
                {dueDatePickerMonthCells.map((day, index) => {
                  if (!day) {
                    return <div key={`due-blank-${index}`} className="calendar-cell calendar-cell--blank compact" />;
                  }

                  const hasSelectedValue = draft.dueDate && sameDay(day, parseDateKey(draft.dueDate) ?? new Date(0));
                  const isToday = sameDay(day, new Date());

                  return (
                    <button
                      key={dateKey(day)}
                      type="button"
                      className={`calendar-cell calendar-cell--day compact ${hasSelectedValue ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
                      onClick={() => applyDueDate(dateKey(day))}
                    >
                      <div className="calendar-cell__daynum">{day.getDate()}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="due-date-modal__footer">
              <button type="button" className="topbar-link" onClick={() => applyDueDate('')}>
                {copy.clearDate}
              </button>
              <button type="button" className="topbar-link" onClick={() => setIsDueDatePickerOpen(false)}>
                {copy.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isCalendarOpen ? (
        <div className="modal-backdrop" onClick={() => setIsCalendarOpen(false)}>
          <div className="calendar-modal" onClick={(event) => event.stopPropagation()}>
            <div className="calendar-modal__header">
                <div className="calendar-toolbar__title">
                  <h2>{copy.calendarTitle}</h2>
                </div>
                <div className="calendar-toolbar__actions">
                <div className="calendar-view-switch">
                  <button
                    type="button"
                    className={`calendar-view-switch__button ${calendarView === 'month' ? 'is-active' : ''}`}
                    onClick={() => setCalendarView('month')}
                  >
                    {copy.monthView}
                  </button>
                  <button
                    type="button"
                    className={`calendar-view-switch__button ${calendarView === 'week' ? 'is-active' : ''}`}
                    onClick={() => setCalendarView('week')}
                  >
                    {copy.weekView}
                  </button>
                </div>
                <button type="button" className="topbar-link" onClick={() => shiftCalendar(-1)}>
                  ‹
                </button>
                <button
                  type="button"
                  className="topbar-link"
                  onClick={() => {
                    const today = startOfDay(new Date());
                    setCalendarCursor(today);
                    setSelectedCalendarDate(today);
                  }}
                >
                  {copy.today}
                </button>
                <button type="button" className="topbar-link" onClick={() => shiftCalendar(1)}>
                  ›
                </button>
                <button type="button" className="icon-button" onClick={() => setIsCalendarOpen(false)} aria-label={copy.close}>
                  ×
                </button>
              </div>
            </div>

            <section className="calendar-layout">
              <div className="calendar-panel">
                <div className="calendar-grid calendar-grid--header">
                  {weekdayLabels.map((label) => (
                    <div key={label} className="calendar-cell calendar-cell--header">
                      {label}
                    </div>
                  ))}
                </div>

                <div className={`calendar-grid calendar-grid--body ${calendarView === 'month' ? 'is-month' : 'is-week'}`}>
                  {(calendarView === 'month' ? monthCells : calendarDays).map((day, index) => {
                    if (!day) {
                      return <div key={`blank-${index}`} className="calendar-cell calendar-cell--blank" />;
                    }

                    const key = dateKey(day);
                    const items = todosByDate.get(key) ?? [];
                    const hasPending = items.some((todo) => !todo.isCompleted);
                    const isSelected = sameDay(day, selectedCalendarDate);

                    return (
                      <button
                        key={key}
                        type="button"
                        className={`calendar-cell calendar-cell--day ${sameDay(day, new Date()) ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => setSelectedCalendarDate(day)}
                      >
                        <div className="calendar-cell__daynum">{day.getDate()}</div>
                        {items.length > 0 ? (
                          <span className={`calendar-cell__badge ${hasPending ? 'is-danger' : 'is-success'}`}>
                            {items.length}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="calendar-agenda">
                <div className="calendar-agenda__header">
                  <h3>{selectedDateTitle}</h3>
                </div>

                <div className={`calendar-agenda__list ${selectedDateTodos.length === 0 ? 'is-empty' : ''}`}>
                  {selectedDateTodos.length === 0 ? <p className="calendar-empty">{copy.noScheduledTodos}</p> : null}

                  {selectedDateTodos.map((todo) => (
                    <div
                      key={todo.id}
                      className={`calendar-agenda__item ${todo.isCompleted ? 'is-completed' : ''}`}
                    >
                      <span className={`calendar-agenda__status ${todo.isCompleted ? 'is-completed' : ''}`} />
                      <button
                        type="button"
                        className="calendar-agenda__content-button"
                        onClick={() => openTodoFromCalendar(todo)}
                      >
                        <span className="calendar-agenda__content">
                          <strong>{todo.title || copy.untitledTodo}</strong>
                          <span>{todo.summary || copy.noSummary}</span>
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
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
    dueDate: todo.dueDate ? todo.dueDate.slice(0, 10) : '',
    subitems: todo.subitems,
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

function formatDueDate(value: string, locale: Locale) {
  const date = parseDateKey(value);
  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export default App;
