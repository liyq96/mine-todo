import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo, useState } from 'react';
import { APP_INFO, messages } from './appMessages';
import type { Locale } from './appTypes';
import { CalendarModal } from './features/calendar/CalendarModal';
import { DueDatePickerModal } from './features/calendar/DueDatePickerModal';
import { SettingsModal } from './features/settings/SettingsModal';
import { DeleteGroupConfirm } from './features/todos/DeleteGroupConfirm';
import { DeleteTodoConfirm } from './features/todos/DeleteTodoConfirm';
import { TodoDetailPane } from './features/todos/TodoDetailPane';
import { TodoSidebar } from './features/todos/TodoSidebar';
import { useSubitemEditor } from './hooks/useSubitemEditor';
import { useTodoAutosave } from './hooks/useTodoAutosave';
import { useCalendarState } from './hooks/useCalendarState';
import { useSettingsController } from './hooks/useSettingsController';
import { useTodoScrollSync } from './hooks/useTodoScrollSync';
import { useTodoWorkspace } from './hooks/useTodoWorkspace';
import { formatCreatedAt, formatDueDate, parseDateKey, startOfDay, startOfMonth } from './lib/date';
import type { Todo, TodoGroup } from './types';

function App() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [groupPendingDelete, setGroupPendingDelete] = useState<TodoGroup | null>(null);
  const [deleteGroupTodos, setDeleteGroupTodos] = useState(false);

  const {
    config,
    groups,
    todos,
    selectedId,
    activeGroupId,
    draft,
    loading,
    quickTitle,
    isEditing,
    isDeleteConfirmOpen,
    selectedTodo,
    setDraft,
    setQuickTitle,
    setIsEditing,
    setIsDeleteConfirmOpen,
    applyBootstrap,
    syncUpdatedTodo,
    selectTodo,
    selectGroup,
    handleCreateGroup,
    handleRenameGroup,
    handleDeleteGroup,
    handleCreateTodo,
    handleDeleteTodo,
    handleToggleCompleted,
  } = useTodoWorkspace({
    unknownErrorText: messages['zh-CN'].unknownError as string,
    setSaving,
    setError,
  });

  const locale: Locale = config?.language ?? 'zh-CN';
  const copy = messages[locale];

  const selectedGroupName =
    groups.find((group) => group.id === (isEditing ? draft.groupId : selectedTodo?.groupId))?.name ??
    copy.sidebarGroup.defaultGroupName;

  const detailHTML = useMemo(() => {
    const source = isEditing ? draft.detailMarkdown : selectedTodo?.detailMarkdown;
    const html = marked.parse(source || '', { breaks: true }) as string;
    return DOMPurify.sanitize(html);
  }, [draft.detailMarkdown, isEditing, selectedTodo?.detailMarkdown]);

  const {
    isDueDatePickerOpen,
    setIsDueDatePickerOpen,
    dueDatePickerCursor,
    setDueDatePickerCursor,
    isCalendarOpen,
    setIsCalendarOpen,
    calendarView,
    setCalendarView,
    setCalendarCursor,
    selectedCalendarDate,
    setSelectedCalendarDate,
    selectedDateTodos,
    selectedDateTitle,
    weekdayLabels,
    dueDatePickerCells,
    calendarCells,
    openCalendarBoard: openCalendarState,
    shiftCalendar,
    openDueDatePicker,
  } = useCalendarState(todos, locale, draft.dueDate);

  const { registerTodoRef, requestScrollToTodo } = useTodoScrollSync(selectedId, todos);

  const {
    storageInput,
    isSettingsOpen,
    settingsTab,
    isDirectoryConfirmOpen,
    openSettings,
    closeSettings,
    handleRequestStorageDirChange,
    handleConfirmStorageDir,
    handleBrowseStorageDir,
    handleChangeLanguage,
    setSettingsTab,
    setIsDirectoryConfirmOpen,
  } = useSettingsController({
    storageDir: config?.storageDir ?? '',
    locale,
    setSaving,
    setError,
    unknownErrorText: copy.unknownError as string,
    applyBootstrap: (data) => {
      clearSubitemEditingState();
      applyBootstrap(data);
      setSaveStatus('saved');
    },
  });

  const { saveStatus, setSaveStatus } = useTodoAutosave({
    selectedId,
    selectedTodo,
    draft,
    isEditing,
    setSaving,
    setError,
    unknownErrorText: copy.unknownError as string,
    syncUpdatedTodo,
  });

  const {
    visibleSubitems,
    selectedSubitemIds,
    pendingSubitems,
    editingSubitemId,
    editingSubitemContent,
    setEditingSubitemContent,
    clearSubitemEditingState,
    handleAddSubitemInput,
    handlePendingSubitemChange,
    removePendingSubitem,
    startEditingSubitem,
    cancelEditingSubitem,
    commitPendingSubitem,
    commitEditingSubitem,
    toggleSubitemSelection,
    handleDeleteSelectedSubitems,
    handleToggleSubitemCompleted,
  } = useSubitemEditor({
    selectedId,
    draft,
    selectedTodo,
    isEditing,
    setDraft,
    setSaving,
    setError,
    unknownErrorText: copy.unknownError as string,
    syncUpdatedTodo,
  });

  function exitEditMode() {
    clearSubitemEditingState();
    setIsEditing(false);
    setSaveStatus('saved');
  }

  function requestDeleteTodo() {
    if (!selectedId) {
      return;
    }
    setIsDeleteConfirmOpen(true);
  }

  function handleSelectTodo(todo: Todo) {
    clearSubitemEditingState();
    selectTodo(todo);
    setSaveStatus('saved');
  }

  async function handleCreateNewTodo() {
    clearSubitemEditingState();
    await handleCreateTodo(quickTitle, copy.newTodoTitle as string);
    setSaveStatus('saved');
  }

  async function handleConfirmDeleteTodo() {
    await handleDeleteTodo();
    clearSubitemEditingState();
    setSaveStatus('saved');
  }

  async function handleTodoCompletedToggle(todo: Todo) {
    await handleToggleCompleted(todo);
    setSaveStatus('saved');
  }

  async function handleRenameSelectedGroup(id: string, name: string) {
    await handleRenameGroup(id, name);
    setSaveStatus('saved');
  }

  function requestDeleteGroup(group: TodoGroup) {
    setGroupPendingDelete(group);
    setDeleteGroupTodos(false);
  }

  async function confirmDeleteGroup() {
    if (!groupPendingDelete) {
      return;
    }
    clearSubitemEditingState();
    await handleDeleteGroup(groupPendingDelete.id, deleteGroupTodos);
    setGroupPendingDelete(null);
    setDeleteGroupTodos(false);
    setSaveStatus('saved');
  }

  function openCalendarBoard() {
    setIsEditing(false);
    clearSubitemEditingState();
    openCalendarState();
  }

  function openTodoFromCalendar(todo: Todo) {
    requestScrollToTodo(todo.id);
    handleSelectTodo(todo);
    setIsCalendarOpen(false);
  }

  function applyDueDate(value: string) {
    setDraft((current) => ({ ...current, dueDate: value }));
    setIsDueDatePickerOpen(false);
  }

  const createdAtText = useMemo(
    () => (selectedTodo ? formatCreatedAt(selectedTodo.createdAt, locale, copy) : ''),
    [copy, locale, selectedTodo],
  );

  return (
    <>
      <div className="shell">
        <TodoSidebar
          remainingCountText={copy.remainingCount(todos.filter((item) => !item.isCompleted).length)}
          totalCountText={copy.totalCount(todos.length)}
          copy={{
            setting: copy.setting,
            quickAddPlaceholder: copy.quickAddPlaceholder,
            calendarEntryTitle: copy.calendarEntryTitle,
            calendarEntryDescription: copy.calendarEntryDescription,
            loading: copy.loading,
            emptyTodos: copy.emptyTodos,
            untitledTodo: copy.untitledTodo,
            noSummary: copy.noSummary,
            groupsTitle: copy.sidebarGroup.groupsTitle,
            addGroup: copy.sidebarGroup.addGroup,
            addGroupPlaceholder: copy.sidebarGroup.addGroupPlaceholder,
            emptyGroup: copy.sidebarGroup.emptyGroup,
            renameGroup: copy.sidebarGroup.renameGroup,
            deleteGroup: copy.sidebarGroup.deleteGroup,
            defaultGroupName: copy.sidebarGroup.defaultGroupName,
          }}
          quickTitle={quickTitle}
          isCalendarOpen={isCalendarOpen}
          loading={loading}
          saving={saving}
          groups={groups}
          todos={todos}
          selectedId={selectedId}
          activeGroupId={activeGroupId}
          onOpenSettings={() => openSettings('data')}
          onQuickTitleChange={setQuickTitle}
          onQuickCreate={() => void handleCreateNewTodo()}
          onOpenCalendarBoard={openCalendarBoard}
          onRegisterTodoRef={registerTodoRef}
          onSelectTodo={handleSelectTodo}
          onSelectGroup={selectGroup}
          onToggleCompleted={(todo) => void handleTodoCompletedToggle(todo)}
          onCreateGroup={(name) => void handleCreateGroup(name)}
          onRenameGroup={(id, name) => void handleRenameSelectedGroup(id, name)}
          onRequestDeleteGroup={requestDeleteGroup}
        />

        <TodoDetailPane
          error={error}
          selectedTodo={selectedTodo}
          copy={{
            blankTitle: copy.blankTitle,
            blankDescription: copy.blankDescription,
            exitEdit: copy.exitEdit,
            edit: copy.edit,
            delete: copy.delete,
            titlePlaceholder: copy.titlePlaceholder,
            summaryPlaceholder: copy.summaryPlaceholder,
            groupLabel: copy.groupDetail.groupLabel,
            dueDateLabel: copy.dueDateLabel,
            dueDateNone: copy.dueDateNone,
            clearDate: copy.clearDate,
            markdown: copy.markdown,
            markdownPlaceholder: copy.markdownPlaceholder,
            subitemsTitle: copy.subitemsTitle,
            deleteSelectedSubitems: copy.deleteSelectedSubitems,
            addSubitem: copy.addSubitem,
            subitemPlaceholder: copy.subitemPlaceholder,
            emptySubitems: copy.emptySubitems,
            untitledTodo: copy.untitledTodo,
            saveStatus: copy.saveStatus,
          }}
          createdAtText={createdAtText}
          saveStatus={saveStatus}
          isEditing={isEditing}
          saving={saving}
          draft={draft}
          groups={groups}
          selectedGroupName={selectedGroupName}
          detailHTML={detailHTML}
          visibleSubitems={visibleSubitems}
          pendingSubitems={pendingSubitems}
          selectedSubitemIds={selectedSubitemIds}
          editingSubitemId={editingSubitemId}
          editingSubitemContent={editingSubitemContent}
          onExitEditMode={exitEditMode}
          onEnterEditMode={() => setIsEditing(true)}
          onRequestDelete={requestDeleteTodo}
          onDraftChange={(updater) => setDraft(updater)}
          onDraftGroupChange={(groupId) => setDraft((current) => ({ ...current, groupId }))}
          onOpenDueDatePicker={openDueDatePicker}
          onDeleteSelectedSubitems={() => void handleDeleteSelectedSubitems()}
          onAddSubitemInput={handleAddSubitemInput}
          onToggleSubitemSelection={toggleSubitemSelection}
          onStartEditingSubitem={startEditingSubitem}
          onEditingSubitemContentChange={setEditingSubitemContent}
          onCommitEditingSubitem={() => void commitEditingSubitem()}
          onCancelEditingSubitem={cancelEditingSubitem}
          onPendingSubitemChange={handlePendingSubitemChange}
          onCommitPendingSubitem={(id) => void commitPendingSubitem(id)}
          onRemovePendingSubitem={removePendingSubitem}
          onToggleSubitemCompleted={(subitem) => void handleToggleSubitemCompleted(subitem)}
          formattedDraftDueDate={draft.dueDate ? formatDueDate(draft.dueDate, locale) : copy.dueDateNone}
          formattedSelectedDueDate={selectedTodo?.dueDate ? formatDueDate(selectedTodo.dueDate, locale) : copy.dueDateNone}
        />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        copy={{
          settingsTitle: copy.settingsTitle,
          close: copy.close,
          tabs: copy.tabs,
          dataTitle: copy.dataTitle,
          dataDescription: copy.dataDescription,
          directoryLabel: copy.directoryLabel,
          chooseDirectory: copy.chooseDirectory,
          cancel: copy.cancel,
          saveDirectory: copy.saveDirectory,
          languageTitle: copy.languageTitle,
          languageDescription: copy.languageDescription,
          languageLabel: copy.languageLabel,
          aboutTitle: copy.aboutTitle,
          aboutDescription: copy.aboutDescription,
          projectName: copy.projectName,
          version: copy.version,
          releaseDate: copy.releaseDate,
          loading: copy.loading,
          switchDirectoryTitle: copy.switchDirectoryTitle,
          switchDirectoryDescription: copy.switchDirectoryDescription,
          switchDirectoryCopy: copy.switchDirectoryCopy,
          switchDirectoryCopyHint: copy.switchDirectoryCopyHint,
          switchDirectoryFresh: copy.switchDirectoryFresh,
          switchDirectoryFreshHint: copy.switchDirectoryFreshHint,
          languageOptions: copy.languageOptions,
        }}
        locale={locale}
        settingsTab={settingsTab}
        config={config}
        storageInput={storageInput}
        saving={saving}
        isDirectoryConfirmOpen={isDirectoryConfirmOpen}
        appInfo={APP_INFO}
        onClose={closeSettings}
        onTabChange={setSettingsTab}
        onBrowseStorageDir={() => void handleBrowseStorageDir()}
        onRequestStorageDirChange={handleRequestStorageDirChange}
        onChangeLanguage={(language) => void handleChangeLanguage(language)}
        onCloseDirectoryConfirm={() => setIsDirectoryConfirmOpen(false)}
        onConfirmStorageDir={(mode) => void handleConfirmStorageDir(mode)}
      />

      <DeleteTodoConfirm
        isOpen={isDeleteConfirmOpen}
        title={copy.confirmDeleteTitle}
        description={copy.confirmDeleteDescription}
        cancelLabel={copy.cancel}
        confirmLabel={copy.confirmDeleteAction}
        saving={saving}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => void handleConfirmDeleteTodo()}
      />

      <DeleteGroupConfirm
        isOpen={groupPendingDelete !== null}
        title={copy.groupDetail.deleteTitle}
        description={copy.groupDetail.deleteDescription(groupPendingDelete?.name ?? '')}
        checkboxLabel={copy.groupDetail.deleteCheckbox}
        hint={copy.groupDetail.deleteHint}
        checked={deleteGroupTodos}
        cancelLabel={copy.cancel}
        confirmLabel={copy.groupDetail.deleteConfirm}
        saving={saving}
        onCheckedChange={setDeleteGroupTodos}
        onClose={() => {
          setGroupPendingDelete(null);
          setDeleteGroupTodos(false);
        }}
        onConfirm={() => void confirmDeleteGroup()}
      />

      <DueDatePickerModal
        isOpen={isDueDatePickerOpen}
        title={copy.chooseDate}
        monthLabel={new Intl.DateTimeFormat(locale, {
          year: 'numeric',
          month: 'long',
        }).format(dueDatePickerCursor)}
        todayLabel={copy.today}
        clearLabel={copy.clearDate}
        cancelLabel={copy.cancel}
        closeLabel={copy.close}
        weekdayLabels={weekdayLabels}
        cells={dueDatePickerCells}
        onClose={() => setIsDueDatePickerOpen(false)}
        onPreviousMonth={() => setDueDatePickerCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
        onToday={() => setDueDatePickerCursor(startOfMonth(new Date()))}
        onNextMonth={() => setDueDatePickerCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
        onPickDate={applyDueDate}
        onClear={() => applyDueDate('')}
      />

      <CalendarModal
        isOpen={isCalendarOpen}
        copy={{
          title: copy.calendarTitle,
          monthView: copy.monthView,
          weekView: copy.weekView,
          today: copy.today,
          close: copy.close,
          untitledTodo: copy.untitledTodo,
          noSummary: copy.noSummary,
          noScheduledTodos: copy.noScheduledTodos,
        }}
        view={calendarView}
        weekdayLabels={weekdayLabels}
        selectedDateTitle={selectedDateTitle}
        selectedDateTodos={selectedDateTodos}
        cells={calendarCells}
        onClose={() => setIsCalendarOpen(false)}
        onViewChange={setCalendarView}
        onPrevious={() => shiftCalendar(-1)}
        onToday={() => {
          const today = startOfDay(new Date());
          setCalendarCursor(today);
          setSelectedCalendarDate(today);
        }}
        onNext={() => shiftCalendar(1)}
        onSelectDate={(key) => {
          const nextDate = parseDateKey(key);
          if (nextDate) {
            setSelectedCalendarDate(nextDate);
          }
        }}
        onOpenTodo={openTodoFromCalendar}
      />
    </>
  );
}

export default App;
