import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { flushSync } from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { APP_INFO, messages } from './appMessages';
import type { Locale, WorkspaceMode } from './appTypes';
import { CalendarModal } from './features/calendar/CalendarModal';
import { DueDatePickerModal } from './features/calendar/DueDatePickerModal';
import { NoteEditorPane } from './features/notes/NoteEditorPane';
import { GlobalSearchDialog } from './features/search/GlobalSearchDialog';
import { TrashModal } from './features/trash/TrashModal';
import { SettingsModal } from './features/settings/SettingsModal';
import { DeleteGroupConfirm } from './features/todos/DeleteGroupConfirm';
import { DeleteTodoConfirm } from './features/todos/DeleteTodoConfirm';
import { TodoDetailPane } from './features/todos/TodoDetailPane';
import { TodoSidebar } from './features/todos/TodoSidebar';
import { useSubitemEditor } from './hooks/useSubitemEditor';
import { useBusyState } from './hooks/useBusyState';
import { useCloseGuard } from './hooks/useCloseGuard';
import { useCalendarState } from './hooks/useCalendarState';
import { useNoteWorkspace } from './hooks/useNoteWorkspace';
import { useSettingsController } from './hooks/useSettingsController';
import { useTodoScrollSync } from './hooks/useTodoScrollSync';
import { useTodoWorkspace } from './hooks/useTodoWorkspace';
import { useTrashActions } from './hooks/useTrashActions';
import { useTodoReminders } from './hooks/useTodoReminders';
import { formatCreatedAt, formatDueDate, parseDateKey, startOfDay, startOfMonth } from './lib/date';
import { noteBacklinks, renderInternalNoteLinks } from './lib/productivity';
import type { WorkspaceSearchResult } from './lib/productivity';
import { backend } from './lib/wails';
import type { Todo, TodoGroup } from './types';

type TrashKind = 'group' | 'todo' | 'note';

function App() {
  const { saving, setSaving, waitForIdle } = useBusyState();
  const { saving: isTransitioning, setSaving: setIsTransitioning } = useBusyState();
  const shellRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (shellRef.current) shellRef.current.inert = isTransitioning; }, [isTransitioning]);
  const [error, setError] = useState('');
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('todos');
  const [isDeleteNoteConfirmOpen, setIsDeleteNoteConfirmOpen] = useState(false);
  const [groupPendingDelete, setGroupPendingDelete] = useState<TodoGroup | null>(null);
  const [deleteGroupTodos, setDeleteGroupTodos] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [undoTrash, setUndoTrash] = useState<{ kind: TrashKind; id: string } | null>(null);

  const {
    config,
    saveStatus,
    flushCurrentTodo,
    groups,
    todos,
    notes,
    trash,
    selectedId,
    activeGroupId,
    draft,
    loading,
    isCreatingTodo,
    isDeletingTodo,
    togglingTodoIds,
    quickTitle,
    isEditing,
    isDeleteConfirmOpen,
    selectedTodo,
    setDraft,
    setNotes,
    setTrash,
    setQuickTitle,
    setIsEditing,
    setIsDeleteConfirmOpen,
    applyBootstrap,
    refreshBootstrap,
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
    suspended: isTransitioning,
    setSaving,
    setError,
  });

  const locale: Locale = config?.language ?? 'zh-CN';
  const copy = messages[locale];
  const errorMessage = error === 'database changed' ? copy.databaseChanged : error;

  const { isEmptyingTrash, emptyTrashError, handleEmptyTrash, clearEmptyTrashError } = useTrashActions({
    beforeUpdate: flushAllEdits,
    setSaving,
    unknownErrorText: copy.unknownError as string,
    onUpdated: (data) => applyBootstrap(data, true),
    onEmptied: () => setUndoTrash(null),
  });

  const {
    selectedNote,
    selectedNoteId,
    noteDraft,
    noteSaveStatus,
    isNotePreview,
    setNoteDraft,
    setIsNotePreview,
    selectNote,
    createNote,
    deleteNote,
    flushCurrentNote,
    importMarkdown,
    exportDocument,
  } = useNoteWorkspace({
    databasePath: config?.dbPath ?? '',
    suspended: isTransitioning || isDeleteNoteConfirmOpen,
    notes,
    setNotes,
    untitledNote: copy.untitledNote as string,
    markdownErrors: copy.markdownErrors,
    unknownErrorText: copy.unknownError as string,
    setSaving,
    setError,
    onSaved: refreshBootstrap,
  });

  const notePreviewHTML = useMemo(() => {
    const source = renderInternalNoteLinks(noteDraft.contentMarkdown || '', notes, selectedNote?.internalLinks ?? []);
    const html = marked.parse(source, { breaks: true }) as string;
    return DOMPurify.sanitize(html);
  }, [noteDraft.contentMarkdown, notes, selectedNote?.internalLinks]);

  const selectedNoteBacklinks = useMemo(
    () => selectedNote ? noteBacklinks(selectedNote, notes) : [],
    [notes, selectedNote],
  );

  useEffect(() => {
    function handleGlobalSearchShortcut(event: KeyboardEvent) {
      if (event.repeat || event.isComposing) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLocaleLowerCase() !== 'k') return;
      event.preventDefault();
      setIsGlobalSearchOpen((current) => !current);
    }
    window.addEventListener('keydown', handleGlobalSearchShortcut);
    return () => window.removeEventListener('keydown', handleGlobalSearchShortcut);
  }, []);

  useTodoReminders(config?.dbPath ?? '', todos, copy.productivity.reminderBody);

  async function handleWorkspaceModeChange(nextMode: WorkspaceMode) {
    if (!(await flushAllEdits())) return false;
    setWorkspaceMode(nextMode);
    if (nextMode === 'notes') {
      setIsNotePreview(true);
    }
    return true;
  }

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
  } = useCalendarState(todos, locale, draft.dueDate);

  const { registerTodoRef, requestScrollToTodo } = useTodoScrollSync(selectedId, todos);

  const sidebarTodos = useMemo(() => todos.map((todo) => todo.id === selectedId
    ? { ...todo, priority: draft.priority }
    : todo), [todos, selectedId, draft.priority]);

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
    existingDatabaseError: copy.targetDatabaseExists,
    beforeChange: () => prepareWorkspaceChange(1),
    afterChange: () => setIsTransitioning(false),
    applyBootstrap: (data) => {
      clearSubitemEditingState();
      applyBootstrap(data);
    },
  });

  const {
    flushSubitems,
    visibleSubitems,
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
    handleDeleteSubitem,
    handleToggleSubitemCompleted,
  } = useSubitemEditor({
    selectedId,
    draft,
    selectedTodo,
    isEditing,
    setSaving,
    setError,
    unknownErrorText: copy.unknownError as string,
    syncUpdatedTodo,
  });

  async function flushAllEdits() {
    if (!(await flushSubitems())) return false;
    if (!(await flushCurrentTodo())) return false;
    if (!(await flushCurrentNote())) return false;
    return true;
  }

  async function prepareWorkspaceChange(maximumPending = 0) {
    setIsTransitioning(true);
    if (shellRef.current) shellRef.current.inert = true;
    // Window-close events may arrive while the window is minimized. Do not
    // depend on animation frames, which browsers can pause in hidden windows.
    flushSync(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
    if (!(await flushAllEdits())) return false;
    await waitForIdle(maximumPending);
    flushSync(() => {});
    return flushAllEdits();
  }

  useCloseGuard({
    prepare: () => prepareWorkspaceChange(),
    finish: () => setIsTransitioning(false),
    onError: setError,
    errorText: copy.unknownError as string,
  });

  async function exitEditMode() {
    if (!(await flushAllEdits())) return;
    clearSubitemEditingState();
    setIsEditing(false);
  }

  function requestDeleteTodo() {
    if (!selectedId) {
      return;
    }
    setIsDeleteConfirmOpen(true);
  }

  async function handleSelectTodo(todo: Todo) {
    if (!(await flushSubitems())) return false;
    if (!(await selectTodo(todo))) return false;
    clearSubitemEditingState();
    return true;
  }

  async function handleCreateNewTodo(title = quickTitle, groupID?: string) {
    if (!(await flushAllEdits())) return;
    clearSubitemEditingState();
    await handleCreateTodo(title, copy.newTodoTitle as string, groupID);
  }

  async function handleConfirmDeleteTodo() {
    if (!(await flushAllEdits())) return;
    const deletedID = selectedId;
    const deleted = await handleDeleteTodo();
    if (deleted && deletedID) setUndoTrash({ kind: 'todo', id: deletedID });
    if (deleted) {
      clearSubitemEditingState();
    }
  }

  async function handleTodoCompletedToggle(todo: Todo) {
    await handleToggleCompleted(todo);
  }

  async function handleRenameSelectedGroup(id: string, name: string) {
    await handleRenameGroup(id, name);
  }

  function requestDeleteGroup(group: TodoGroup) {
    setGroupPendingDelete(group);
    setDeleteGroupTodos(false);
  }

  async function confirmDeleteGroup() {
    if (!groupPendingDelete) {
      return;
    }
    if (!(await flushAllEdits())) return;
    clearSubitemEditingState();
    const deletedID = groupPendingDelete.id;
    const deleted = await handleDeleteGroup(deletedID, deleteGroupTodos);
    if (!deleted) return;
    setUndoTrash({ kind: 'group', id: deletedID });
    setGroupPendingDelete(null);
    setDeleteGroupTodos(false);
  }

  async function restoreTrashItem(kind: TrashKind, id: string) {
    if (!(await flushAllEdits())) return;
    try {
      setSaving(true);
      const data = kind === 'todo'
        ? await backend.restoreTodo(id)
        : kind === 'note'
          ? await backend.restoreNote(id)
          : await backend.restoreGroup(id);
      applyBootstrap(data);
      setUndoTrash(null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unknownError as string);
    } finally {
      setSaving(false);
    }
  }

  async function purgeTrashItem(kind: TrashKind, id: string) {
    if (!(await flushAllEdits())) return;
    try {
      setSaving(true);
      const data = kind === 'todo'
        ? await backend.purgeTodo(id)
        : kind === 'note'
          ? await backend.purgeNote(id)
          : await backend.purgeGroup(id);
      applyBootstrap(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unknownError as string);
    } finally {
      setSaving(false);
    }
  }

  async function openLinkedTodo(todo: Todo) {
    if (!(await handleWorkspaceModeChange('todos'))) return;
    await handleSelectTodo(todo);
  }

  async function openLinkedNote(noteID: string) {
    const note = notes.find((item) => item.id === noteID);
    if (!note) return;
    if (!(await handleWorkspaceModeChange('notes'))) return;
    await selectNote(note);
  }

  async function openGlobalSearchResult(result: WorkspaceSearchResult) {
    if (!(await flushAllEdits())) return;
    setIsGlobalSearchOpen(false);
    setIsCalendarOpen(false);
    setIsDueDatePickerOpen(false);
    setIsTrashOpen(false);
    setIsDeleteConfirmOpen(false);
    setIsDeleteNoteConfirmOpen(false);
    setGroupPendingDelete(null);
    closeSettings();
    if (result.kind === 'todo') {
      if (!(await handleWorkspaceModeChange('todos'))) return;
      await handleSelectTodo(result.item);
      requestScrollToTodo(result.item.id);
      return;
    }
    if (!(await handleWorkspaceModeChange('notes'))) return;
    await selectNote(result.item);
  }

  async function openCalendarBoard() {
    if (!(await flushAllEdits())) return;
    setIsEditing(false);
    clearSubitemEditingState();
    openCalendarState();
  }

  async function openTodoFromCalendar(todo: Todo) {
    if (!(await handleSelectTodo(todo))) return;
    requestScrollToTodo(todo.id);
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
      <div className="shell" ref={shellRef} aria-busy={isTransitioning}>
        <TodoSidebar
          mode={workspaceMode}
          remainingCountText={copy.remainingCount(todos.filter((item) => !item.isCompleted).length)}
          totalCountText={copy.totalCount(todos.length)}
          noteCountText={copy.noteCount(notes.length)}
          copy={{
            setting: copy.setting,
            todoTab: copy.workspaceTabs.todos,
            noteTab: copy.workspaceTabs.notes,
            quickAddPlaceholder: copy.quickAddPlaceholder,
            calendarEntryTitle: copy.calendarEntryTitle,
            calendarEntryDescription: copy.calendarEntryDescription,
            loading: copy.loading,
            emptyTodos: copy.emptyTodos,
            untitledTodo: copy.untitledTodo,
            groupsTitle: copy.sidebarGroup.groupsTitle,
            addGroup: copy.sidebarGroup.addGroup,
            addGroupPlaceholder: copy.sidebarGroup.addGroupPlaceholder,
            createMenuTitle: copy.sidebarGroup.createMenuTitle,
            createTodo: copy.sidebarGroup.createTodo,
            emptyGroup: copy.sidebarGroup.emptyGroup,
            renameGroup: copy.sidebarGroup.renameGroup,
            deleteGroup: copy.sidebarGroup.deleteGroup,
            defaultGroupName: copy.sidebarGroup.defaultGroupName,
            notesTitle: copy.notesTitle,
            newNote: copy.newNote,
            emptyNotes: copy.emptyNotes,
            untitledNote: copy.untitledNote,
            emptyNotePreview: copy.emptyNotePreview,
            filterTitle: copy.productivity.filterTitle,
            filterViews: copy.productivity.filterViews,
            filterScope: copy.productivity.filterScope,
            clearFilters: copy.productivity.clearFilters,
            tagsTitle: copy.productivity.tagsTitle,
            allTags: copy.productivity.allTags,
            allPriorities: copy.productivity.allPriorities,
            smartViews: copy.productivity.smartViews,
            activeNotes: copy.productivity.activeNotes,
            favoriteNotes: copy.productivity.favoriteNotes,
            archivedNotes: copy.productivity.archivedNotes,
            priorityLabel: copy.productivity.priorityLabel,
            priorities: copy.productivity.priorities,
            pin: copy.productivity.pin,
            favorite: copy.productivity.favorite,
            trash: copy.productivity.trash,
          }}
          quickTitle={quickTitle}
          isCalendarOpen={isCalendarOpen}
          loading={loading}
          isCreatingTodo={isCreatingTodo}
          togglingTodoIds={togglingTodoIds}
          saving={saving}
          groups={groups}
          todos={sidebarTodos}
          notes={notes}
          selectedId={selectedId}
          selectedNoteId={selectedNoteId}
          activeGroupId={activeGroupId}
          onModeChange={handleWorkspaceModeChange}
          onOpenSettings={() => openSettings('data')}
          onQuickTitleChange={setQuickTitle}
          onQuickCreate={() => void handleCreateNewTodo()}
          onOpenCalendarBoard={openCalendarBoard}
          onRegisterTodoRef={registerTodoRef}
          onSelectTodo={handleSelectTodo}
          onSelectNote={(note) => void selectNote(note)}
          onCreateNote={() => void flushAllEdits().then((saved) => { if (saved) void createNote(); })}
          onSelectGroup={selectGroup}
          onToggleCompleted={(todo) => void handleTodoCompletedToggle(todo)}
          onCreateGroup={(name) => void handleCreateGroup(name)}
          onCreateTodo={(groupID) => void handleCreateNewTodo('', groupID)}
          onRenameGroup={(id, name) => void handleRenameSelectedGroup(id, name)}
          onRequestDeleteGroup={requestDeleteGroup}
          onOpenTrash={() => { clearEmptyTrashError(); setIsTrashOpen(true); }}
        />

        {workspaceMode === 'todos' ? <TodoDetailPane
          error={errorMessage}
          selectedTodo={selectedTodo}
          copy={{
            blankTitle: copy.blankTitle,
            blankDescription: copy.blankDescription,
            preview: copy.previewNote,
            edit: copy.edit,
            delete: copy.delete,
            titlePlaceholder: copy.titlePlaceholder,
            summaryPlaceholder: copy.summaryPlaceholder,
            groupLabel: copy.groupDetail.groupLabel,
            dueDateLabel: copy.dueDateLabel,
            dueDateNone: copy.dueDateNone,
            clearDate: copy.clearDate,
            contentPlaceholder: copy.todoContentPlaceholder,
            subitemsTitle: copy.subitemsTitle,
            removeSubitem: copy.removeSubitem,
            addSubitem: copy.addSubitem,
            subitemPlaceholder: copy.subitemPlaceholder,
            emptySubitems: copy.emptySubitems,
            untitledTodo: copy.untitledTodo,
            priorityLabel: copy.productivity.priorityLabel,
            priorities: copy.productivity.priorities,
            scheduleLabel: copy.productivity.scheduleLabel,
            scheduleDescription: copy.productivity.scheduleDescription,
            clearSchedule: copy.productivity.clearSchedule,
            applySchedule: copy.productivity.applySchedule,
            cancel: copy.cancel,
            reminderLabel: copy.productivity.reminderLabel,
            tagsLabel: copy.productivity.tagsLabel,
            tagInputPlaceholder: copy.productivity.tagInputPlaceholder,
            removeTag: copy.productivity.removeTag,
            linkedNotesLabel: copy.productivity.linkedNotesLabel,
            relationSearchPlaceholder: copy.productivity.searchLinkedNotes,
            relationEmpty: copy.productivity.noLinkableNotes,
            relationSelectedCount: copy.productivity.linkedCount,
            relationDone: copy.productivity.relationDone,
            close: copy.close,
            untitledRelatedItem: copy.untitledNote,
            favorite: copy.productivity.favorite,
            archive: copy.productivity.archive,
            saveStatus: copy.saveStatus,
            retrySave: copy.retrySave,
          }}
          createdAtText={createdAtText}
          saveStatus={saveStatus}
          onRetrySave={() => void flushCurrentTodo()}
          isEditing={isEditing}
          saving={saving}
          draft={draft}
          isDeleting={isDeletingTodo}
          groups={groups}
          notes={notes}
          selectedGroupName={selectedGroupName}
          detailHTML={detailHTML}
          visibleSubitems={visibleSubitems}
          pendingSubitems={pendingSubitems}
          editingSubitemId={editingSubitemId}
          editingSubitemContent={editingSubitemContent}
          onExitEditMode={exitEditMode}
          onEnterEditMode={() => setIsEditing(true)}
          onRequestDelete={requestDeleteTodo}
          onDraftChange={(updater) => setDraft(updater)}
          onDeleteSubitem={(id) => void handleDeleteSubitem(id)}
          onAddSubitemInput={handleAddSubitemInput}
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
        /> : (
          <NoteEditorPane
            error={errorMessage}
            selectedNote={selectedNote}
            todos={todos}
            backlinks={selectedNoteBacklinks}
            draft={noteDraft}
            saveStatus={noteSaveStatus}
            onRetrySave={() => void flushCurrentNote()}
            isPreview={isNotePreview}
            saving={saving}
            previewHTML={notePreviewHTML}
            locale={locale}
            copy={{
              blankTitle: copy.noteBlankTitle,
              blankDescription: copy.noteBlankDescription,
              createNote: copy.newNote,
              titlePlaceholder: copy.noteTitlePlaceholder,
              contentPlaceholder: copy.noteContentPlaceholder,
              editMode: copy.editNote,
              previewMode: copy.previewNote,
              deleteNote: copy.deleteNote,
              transfer: { ...copy.noteTransfer, importMarkdown: copy.importMarkdown, exportMarkdown: copy.exportMarkdown },
              characterCount: copy.noteCharacterCount,
              updatedAt: copy.noteUpdatedAt,
              tagsLabel: copy.productivity.tagsLabel,
              tagInputPlaceholder: copy.productivity.tagInputPlaceholder,
              removeTag: copy.productivity.removeTag,
              linkedTodosLabel: copy.productivity.linkedTodosLabel,
              relationSearchPlaceholder: copy.productivity.searchLinkedTodos,
              relationEmpty: copy.productivity.noLinkableTodos,
              relationSelectedCount: copy.productivity.linkedCount,
              relationDone: copy.productivity.relationDone,
              close: copy.close,
              untitledRelatedItem: copy.untitledTodo,
              backlinksLabel: copy.productivity.backlinksLabel,
              pin: copy.productivity.pin,
              favorite: copy.productivity.favorite,
              archive: copy.productivity.archive,
              saveStatus: copy.saveStatus,
            retrySave: copy.retrySave,
            }}
            onDraftChange={setNoteDraft}
            onExportDocument={(format) => void exportDocument(format)}
            onImportMarkdown={() => void importMarkdown()}
            onPreviewChange={setIsNotePreview}
            onCreateNote={() => void flushAllEdits().then((saved) => { if (saved) void createNote(); })}
            onRequestDelete={() => setIsDeleteNoteConfirmOpen(true)}
            onSelectTodo={openLinkedTodo}
            onSelectNote={(note) => void selectNote(note)}
            onOpenNoteLink={openLinkedNote}
          />
        )}
      </div>

      <GlobalSearchDialog
        isOpen={isGlobalSearchOpen}
        todos={todos}
        notes={notes}
        copy={{
          ...copy.productivity.globalSearch,
          untitledTodo: copy.untitledTodo,
          untitledNote: copy.untitledNote,
          emptyTodoPreview: copy.noSummary,
          emptyNotePreview: copy.emptyNotePreview,
        }}
        onClose={() => setIsGlobalSearchOpen(false)}
        onOpenResult={openGlobalSearchResult}
      />

      <SettingsModal
        error={errorMessage}
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
          shortcutsTitle: copy.shortcutsTitle,
          shortcutsDescription: copy.shortcutsDescription,
          shortcutGroups: copy.shortcutGroups,
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
        saving={isDeletingTodo}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => void handleConfirmDeleteTodo()}
      />

      <DeleteTodoConfirm
        isOpen={isDeleteNoteConfirmOpen}
        title={copy.confirmDeleteNoteTitle}
        description={copy.confirmDeleteNoteDescription}
        cancelLabel={copy.cancel}
        confirmLabel={copy.confirmDeleteNoteAction}
        saving={saving}
        onClose={() => setIsDeleteNoteConfirmOpen(false)}
        onConfirm={() => void (async () => {
          if (!(await flushAllEdits())) return;
          const deletedNote = selectedNote;
          if (!(await deleteNote())) return;
          setIsDeleteNoteConfirmOpen(false);
          if (deletedNote) {
            setUndoTrash({ kind: 'note', id: deletedNote.id });
            setTrash((current) => ({ ...current, notes: [...current.notes.filter((note) => note.id !== deletedNote.id), {
              ...deletedNote, isTrashed: true, trashedAt: new Date().toISOString(),
            }] }));
          }
          try { await refreshBootstrap(); } catch { /* Keep the successful local deletion and trash entry. */ }
        })()}
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

      <TrashModal
        isOpen={isTrashOpen}
        trash={trash}
        saving={saving}
        emptying={isEmptyingTrash}
        emptyError={emptyTrashError}
        copy={{
          title: copy.productivity.trashTitle,
          description: copy.productivity.trashDescription,
          empty: copy.productivity.trashEmpty,
          close: copy.close,
          restore: copy.productivity.restore,
          purge: copy.productivity.purge,
          confirmPurge: copy.productivity.confirmPurge,
          emptyAll: copy.productivity.emptyTrash,
          emptyConfirmTitle: copy.productivity.emptyTrashTitle,
          emptyConfirmDescription: copy.productivity.emptyTrashDescription,
          emptying: copy.productivity.emptyingTrash,
          itemCount: copy.productivity.trashItemCount,
          cancel: copy.cancel,
          groups: copy.productivity.groups,
          todos: copy.productivity.todos,
          notes: copy.productivity.notes,
        }}
        onClose={() => setIsTrashOpen(false)}
        onRestore={(kind, id) => void restoreTrashItem(kind, id)}
        onPurge={(kind, id) => void purgeTrashItem(kind, id)}
        onEmpty={handleEmptyTrash}
      />

      {undoTrash ? (
        <div className="undo-toast" role="status">
          <span>{copy.productivity.movedToTrash}</span>
          <button type="button" disabled={saving} onClick={() => void restoreTrashItem(undoTrash.kind, undoTrash.id)}>{copy.productivity.undo}</button>
          <button type="button" onClick={() => setUndoTrash(null)} aria-label={copy.close}>×</button>
        </div>
      ) : null}

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
