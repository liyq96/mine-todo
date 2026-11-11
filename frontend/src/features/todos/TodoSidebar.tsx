import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconArchive,
  IconCalendarMonth,
  IconCalendarOff,
  IconCheck,
  IconClock,
  IconChevronRight,
  IconDots,
  IconFileText,
  IconFilter,
  IconFlag3,
  IconFolder,
  IconFolderOpen,
  IconListCheck,
  IconNote,
  IconPencil,
  IconPinFilled,
  IconPlus,
  IconSettings,
  IconStarFilled,
  IconTag,
  IconTrash,
} from '@tabler/icons-react';
import { AnchoredPopover } from '../_primitives/AnchoredPopover';
import type { NoteFilter, TodoSmartView, WorkspaceMode } from '../../appTypes';
import { TODO_PRIORITIES, TODO_PRIORITY_RANK } from '../../lib/priorities';
import { matchesTodoView } from '../../lib/productivity';
import type { Note, Todo, TodoGroup, TodoPriority } from '../../types';

type SidebarCopy = {
  setting: string;
  todoTab: string;
  noteTab: string;
  quickAddPlaceholder: string;
  calendarEntryTitle: string;
  calendarEntryDescription: string;
  loading: string;
  emptyTodos: string;
  untitledTodo: string;
  groupsTitle: string;
  addGroup: string;
  addGroupPlaceholder: string;
  createMenuTitle: string;
  createTodo: string;
  emptyGroup: string;
  renameGroup: string;
  deleteGroup: string;
  defaultGroupName: string;
  notesTitle: string;
  newNote: string;
  emptyNotes: string;
  untitledNote: string;
  emptyNotePreview: string;
  filterTitle: string;
  filterViews: string;
  filterScope: string;
  clearFilters: string;
  tagsTitle: string;
  allTags: string;
  allPriorities: string;
  smartViews: Record<TodoSmartView, string>;
  activeNotes: string;
  favoriteNotes: string;
  archivedNotes: string;
  priorityLabel: string;
  priorities: Record<TodoPriority, string>;
  pin: string;
  favorite: string;
  trash: string;
};

type TodoSidebarProps = {
  mode: WorkspaceMode;
  remainingCountText: string;
  totalCountText: string;
  noteCountText: string;
  copy: SidebarCopy;
  quickTitle: string;
  isCalendarOpen: boolean;
  loading: boolean;
  isCreatingTodo: boolean;
  togglingTodoIds: string[];
  saving: boolean;
  groups: TodoGroup[];
  todos: Todo[];
  notes: Note[];
  selectedId: string | null;
  selectedNoteId: string | null;
  activeGroupId: string | null;
  onModeChange: (mode: WorkspaceMode) => void;
  onOpenSettings: () => void;
  onQuickTitleChange: (value: string) => void;
  onQuickCreate: () => void;
  onOpenCalendarBoard: () => void;
  onRegisterTodoRef: (id: string, node: HTMLButtonElement | null) => void;
  onSelectTodo: (todo: Todo) => void;
  onSelectNote: (note: Note) => void;
  onCreateNote: () => void;
  onSelectGroup: (groupID: string) => void;
  onToggleCompleted: (todo: Todo) => void;
  onCreateGroup: (name: string) => void;
  onCreateTodo: (groupID?: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  onRequestDeleteGroup: (group: TodoGroup) => void;
  onOpenTrash: () => void;
};

function noteExcerpt(note: Note, fallback: string) {
  const plainText = note.contentMarkdown.replace(/[#>*_`~-]/g, ' ').replace(/\s+/g, ' ').trim();
  return plainText || fallback;
}

export function TodoSidebar({
  mode,
  remainingCountText,
  totalCountText,
  noteCountText,
  copy,
  quickTitle,
  isCalendarOpen,
  loading,
  isCreatingTodo,
  togglingTodoIds,
  saving,
  groups,
  todos,
  notes,
  selectedId,
  selectedNoteId,
  activeGroupId,
  onModeChange,
  onOpenSettings,
  onQuickTitleChange,
  onQuickCreate,
  onOpenCalendarBoard,
  onRegisterTodoRef,
  onSelectTodo,
  onSelectNote,
  onCreateNote,
  onSelectGroup,
  onToggleCompleted,
  onCreateGroup,
  onCreateTodo,
  onRenameGroup,
  onRequestDeleteGroup,
  onOpenTrash,
}: TodoSidebarProps) {
  const sidebarRef = useRef<HTMLElement | null>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>([]);
  const [menuGroupId, setMenuGroupId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState('');
  const [smartView, setSmartView] = useState<TodoSmartView>('all');
  const [priorityFilter, setPriorityFilter] = useState<TodoPriority | 'all'>('all');
  const [noteFilter, setNoteFilter] = useState<NoteFilter>('active');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  const allTags = useMemo(
    () => Array.from(new Set([...todos.flatMap((todo) => todo.tags), ...notes.flatMap((note) => note.tags)]))
      .sort((left, right) => left.localeCompare(right)),
    [notes, todos],
  );

  const visibleTodos = useMemo(
    () => todos
      .filter((todo) => matchesTodoView(todo, smartView)
        && (priorityFilter === 'all' || todo.priority === priorityFilter)
        && (!selectedTag || todo.tags.includes(selectedTag)))
      .sort((left, right) => {
        return Number(right.isFavorite) - Number(left.isFavorite)
          || TODO_PRIORITY_RANK[left.priority] - TODO_PRIORITY_RANK[right.priority]
          || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }),
    [priorityFilter, selectedTag, smartView, todos],
  );

  const visibleNotes = useMemo(
    () => notes
      .filter((note) => {
        if (noteFilter === 'archived') return note.isArchived;
        if (noteFilter === 'favorites') return note.isFavorite && !note.isArchived;
        return !note.isArchived;
      })
      .filter((note) => !selectedTag || note.tags.includes(selectedTag))
      .sort((left, right) => Number(right.isPinned) - Number(left.isPinned) || Number(right.isFavorite) - Number(left.isFavorite) || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [noteFilter, notes, selectedTag],
  );

  const activeFilterCount = Number(Boolean(selectedTag))
    + (mode === 'todos' ? Number(smartView !== 'all') + Number(priorityFilter !== 'all') : Number(noteFilter !== 'active'));

  const groupedTodos = useMemo(() => {
    const entries = new Map<string, Todo[]>();
    for (const group of groups) entries.set(group.id, []);
    for (const todo of visibleTodos) {
      if (!entries.has(todo.groupId)) entries.set(todo.groupId, []);
      entries.get(todo.groupId)?.push(todo);
    }
    return entries;
  }, [groups, visibleTodos]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!sidebarRef.current?.contains(target)) setMenuGroupId(null);
      if (!createMenuRef.current?.contains(target)) setIsCreateMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuGroupId(null);
        setIsCreateMenuOpen(false);
        setIsFilterMenuOpen(false);
      }
    }
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function submitGroup() {
    const nextName = groupName.trim();
    if (!nextName) return;
    onCreateGroup(nextName);
    setGroupName('');
    setIsAddingGroup(false);
  }

  function submitRenameGroup() {
    const nextName = editingGroupName.trim();
    if (nextName && editingGroupId) onRenameGroup(editingGroupId, nextName);
    setEditingGroupId(null);
    setEditingGroupName('');
  }

  function toggleGroup(groupID: string) {
    onSelectGroup(groupID);
    setCollapsedGroupIds((current) =>
      current.includes(groupID) ? current.filter((item) => item !== groupID) : [...current, groupID],
    );
  }

  function renderFilterPopover() {
    return (
      <AnchoredPopover
        open={isFilterMenuOpen}
        onOpenChange={(open) => {
          setIsFilterMenuOpen(open);
          if (open) setIsCreateMenuOpen(false);
        }}
        contentClassName="sidebar-filter-menu"
        ariaLabel={copy.filterTitle}
        trigger={(
          <button
            type="button"
            className={`sidebar-filter-button ${activeFilterCount ? 'is-active' : ''}`}
            aria-label={copy.filterTitle}
            title={copy.filterTitle}
            aria-pressed={activeFilterCount > 0}
          >
            <IconFilter size={15} stroke={2} aria-hidden="true" />
            {activeFilterCount ? <span className="sidebar-filter-button__count" aria-hidden="true">{activeFilterCount}</span> : null}
          </button>
        )}
      >
        <div className="sidebar-filter-menu__header">
          <strong>{copy.filterTitle}</strong>
          {activeFilterCount ? <span>{activeFilterCount}</span> : null}
        </div>

        <section className="sidebar-filter-menu__section">
          <p>{mode === 'todos' ? copy.filterViews : copy.filterScope}</p>
          <div className="sidebar-filter-menu__options" role="group" aria-label={mode === 'todos' ? copy.filterViews : copy.filterScope}>
            {mode === 'todos' ? (
              (['all', 'today', 'upcoming', 'overdue', 'no-date', 'completed', 'archived'] as TodoSmartView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  role="menuitemradio"
                  aria-checked={smartView === view}
                  className={`sidebar-filter-option ${smartView === view ? 'is-active' : ''}`}
                  onClick={() => setSmartView(view)}
                >
                  <span className="sidebar-filter-option__icon" aria-hidden="true">
                    {view === 'today' || view === 'upcoming' ? <IconClock size={15} stroke={2} /> : null}
                    {view === 'no-date' ? <IconCalendarOff size={15} stroke={2} /> : null}
                    {view === 'completed' ? <IconCheck size={15} stroke={2} /> : null}
                    {view === 'archived' ? <IconArchive size={15} stroke={2} /> : null}
                    {view === 'all' || view === 'overdue' ? <IconListCheck size={15} stroke={2} /> : null}
                  </span>
                  <span>{copy.smartViews[view]}</span>
                  {smartView === view ? <IconCheck className="sidebar-filter-option__check" size={14} stroke={2.4} aria-hidden="true" /> : null}
                </button>
              ))
            ) : (
              (['active', 'favorites', 'archived'] as NoteFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  role="menuitemradio"
                  aria-checked={noteFilter === filter}
                  className={`sidebar-filter-option ${noteFilter === filter ? 'is-active' : ''}`}
                  onClick={() => setNoteFilter(filter)}
                >
                  <span className={`sidebar-filter-option__icon ${filter === 'favorites' ? 'is-favorite' : ''}`} aria-hidden="true">
                    {filter === 'active' ? <IconFileText size={15} stroke={2} /> : null}
                    {filter === 'favorites' ? <IconStarFilled size={15} /> : null}
                    {filter === 'archived' ? <IconArchive size={15} stroke={2} /> : null}
                  </span>
                  <span>{filter === 'active' ? copy.activeNotes : filter === 'favorites' ? copy.favoriteNotes : copy.archivedNotes}</span>
                  {noteFilter === filter ? <IconCheck className="sidebar-filter-option__check" size={14} stroke={2.4} aria-hidden="true" /> : null}
                </button>
              ))
            )}
          </div>
        </section>

        {mode === 'todos' ? (
          <section className="sidebar-filter-menu__section">
            <p>{copy.priorityLabel}</p>
            <div className="sidebar-filter-menu__options" role="group" aria-label={copy.priorityLabel}>
              {(['all', ...TODO_PRIORITIES] as const).map((priority) => (
                <button
                  key={priority}
                  type="button"
                  role="menuitemradio"
                  aria-checked={priorityFilter === priority}
                  className={`sidebar-filter-option ${priorityFilter === priority ? 'is-active' : ''}`}
                  onClick={() => setPriorityFilter(priority)}
                >
                  <span className={`sidebar-filter-option__icon ${priority !== 'all' ? `sidebar-filter-option__icon--priority is-priority-${priority}` : ''}`} aria-hidden="true">
                    <IconFlag3 size={15} stroke={2} />
                  </span>
                  <span>{priority === 'all' ? copy.allPriorities : copy.priorities[priority]}</span>
                  {priorityFilter === priority ? <IconCheck className="sidebar-filter-option__check" size={14} stroke={2.4} aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {allTags.length ? (
          <section className="sidebar-filter-menu__section">
            <p>{copy.tagsTitle}</p>
            <div className="sidebar-filter-menu__options sidebar-filter-menu__tags" role="group" aria-label={copy.tagsTitle}>
              <button type="button" role="menuitemradio" aria-checked={!selectedTag} className={`sidebar-filter-option ${!selectedTag ? 'is-active' : ''}`} onClick={() => setSelectedTag('')}>
                <span className="sidebar-filter-option__icon" aria-hidden="true"><IconTag size={15} stroke={2} /></span>
                <span>{copy.allTags}</span>
                {!selectedTag ? <IconCheck className="sidebar-filter-option__check" size={14} stroke={2.4} aria-hidden="true" /> : null}
              </button>
              {allTags.map((tag) => (
                <button key={tag} type="button" role="menuitemradio" aria-checked={selectedTag === tag} className={`sidebar-filter-option ${selectedTag === tag ? 'is-active' : ''}`} onClick={() => setSelectedTag(tag)}>
                  <span className="sidebar-filter-option__icon" aria-hidden="true"><IconTag size={15} stroke={2} /></span>
                  <span>#{tag}</span>
                  {selectedTag === tag ? <IconCheck className="sidebar-filter-option__check" size={14} stroke={2.4} aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {activeFilterCount ? (
          <button
            type="button"
            role="menuitem"
            className="sidebar-filter-menu__clear"
            onClick={() => {
              setSelectedTag('');
              if (mode === 'todos') {
                setSmartView('all');
                setPriorityFilter('all');
              }
              else setNoteFilter('active');
            }}
          >
            {copy.clearFilters}
          </button>
        ) : null}
      </AnchoredPopover>
    );
  }

  return (
    <aside ref={sidebarRef} className="sidebar">
      <div className="sidebar__topbar">
        <span className="sidebar__mark" aria-hidden="true" />
        <div className="sidebar__meta">
          {mode === 'todos' ? <><span>{remainingCountText}</span><span>{totalCountText}</span></> : <span>{noteCountText}</span>}
        </div>
        <button type="button" className="topbar-icon-link" onClick={onOpenSettings} title={copy.setting} aria-label={copy.setting}>
          <IconSettings size={17} stroke={2} />
        </button>
      </div>

      <nav className="workspace-switch" aria-label={`${copy.todoTab} / ${copy.noteTab}`}>
        <button type="button" className={`workspace-switch__button ${mode === 'todos' ? 'is-active' : ''}`} onClick={() => { setIsFilterMenuOpen(false); onModeChange('todos'); }} aria-current={mode === 'todos' ? 'page' : undefined}>
          <IconListCheck size={16} stroke={2} aria-hidden="true" />{copy.todoTab}
        </button>
        <button type="button" className={`workspace-switch__button ${mode === 'notes' ? 'is-active' : ''}`} onClick={() => { setIsFilterMenuOpen(false); onModeChange('notes'); }} aria-current={mode === 'notes' ? 'page' : undefined}>
          <IconNote size={16} stroke={2} aria-hidden="true" />{copy.noteTab}
        </button>
      </nav>

      {mode === 'todos' ? (
        <>
          <div className="quick-entry">
            <input value={quickTitle} readOnly={isCreatingTodo} aria-busy={isCreatingTodo} onChange={(event) => onQuickTitleChange(event.target.value)} onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.repeat || event.nativeEvent.isComposing || event.keyCode === 229 || isCreatingTodo || !quickTitle.trim()) return;
              event.preventDefault();
              onQuickCreate();
            }} placeholder={copy.quickAddPlaceholder} aria-label={copy.quickAddPlaceholder} />
            <kbd className="quick-entry__key" aria-hidden="true">↵</kbd>
          </div>

          <button type="button" className={`calendar-entry ${isCalendarOpen ? 'is-active' : ''}`} onClick={onOpenCalendarBoard}>
            <span className="calendar-entry__icon" aria-hidden="true"><IconCalendarMonth size={18} stroke={2} /></span>
            <span className="calendar-entry__copy"><strong>{copy.calendarEntryTitle}</strong><span>{copy.calendarEntryDescription}</span></span>
            <IconChevronRight className="calendar-entry__chevron" size={16} stroke={2} aria-hidden="true" />
          </button>

          <div className="group-panel">
            <div className="group-panel__header">
              <span>{copy.groupsTitle}</span>
              <div ref={createMenuRef} className="group-panel__actions">
                {renderFilterPopover()}
                <button type="button" className="group-panel__add" onClick={() => { setIsCreateMenuOpen((current) => !current); setIsFilterMenuOpen(false); setIsAddingGroup(false); setGroupName(''); setMenuGroupId(null); }} title={copy.createMenuTitle} aria-label={copy.createMenuTitle} aria-haspopup="menu" aria-expanded={isCreateMenuOpen}>
                  <IconPlus size={16} stroke={2.2} aria-hidden="true" />
                </button>
                {isCreateMenuOpen ? (
                  <div className="group-row__dropdown group-panel__create-menu" role="menu" aria-label={copy.createMenuTitle}>
                    <button type="button" role="menuitem" className="group-row__dropdown-item" disabled={saving} onClick={() => { setIsCreateMenuOpen(false); setGroupName(''); setIsAddingGroup(true); }}><IconFolder size={13} stroke={2} aria-hidden="true" />{copy.addGroup}</button>
                    <button type="button" role="menuitem" className="group-row__dropdown-item" disabled={saving || isCreatingTodo} onClick={() => { setIsCreateMenuOpen(false); onCreateTodo(activeGroupId ?? groups[0]?.id); }}><IconListCheck size={13} stroke={2} aria-hidden="true" />{copy.createTodo}</button>
                  </div>
                ) : null}
              </div>
            </div>
            {isAddingGroup ? (
              <div className="group-creator">
                <input value={groupName} onChange={(event) => setGroupName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitGroup(); if (event.key === 'Escape') { setIsAddingGroup(false); setGroupName(''); } }} onBlur={() => { if (!groupName.trim()) setIsAddingGroup(false); }} placeholder={copy.addGroupPlaceholder} autoFocus />
              </div>
            ) : null}
          </div>

          <div className="todo-list">
            {loading ? <p className="empty-state">{copy.loading}</p> : null}
            {!loading && groups.length === 0 ? <p className="empty-state">{copy.emptyTodos}</p> : null}
            {!loading && (smartView !== 'all' || selectedTag) && visibleTodos.length === 0 ? <p className="empty-state">{copy.emptyTodos}</p> : null}
            {!loading && groups.map((group) => {
              const items = groupedTodos.get(group.id) ?? [];
              const completedCount = items.filter((item) => item.isCompleted).length;
              const progress = items.length ? Math.round((completedCount / items.length) * 100) : 0;
              const isDefaultGroup = group.id === 'default';
              const isEditingGroup = editingGroupId === group.id;
              const isCollapsed = collapsedGroupIds.includes(group.id);
              const isActiveGroup = activeGroupId === group.id;

              if ((smartView !== 'all' || selectedTag) && items.length === 0) return null;
              return (
                <section key={group.id} className="group-section">
                  <div className={`group-row ${isActiveGroup ? 'is-focused' : ''}`}>
                    {isEditingGroup ? (
                      <input className="group-row__input" value={editingGroupName} onChange={(event) => setEditingGroupName(event.target.value)} onBlur={submitRenameGroup} onKeyDown={(event) => { if (event.key === 'Enter') submitRenameGroup(); if (event.key === 'Escape') { setEditingGroupId(null); setEditingGroupName(''); } }} autoFocus />
                    ) : (
                      <button type="button" className="group-row__main" onClick={() => toggleGroup(group.id)} aria-expanded={!isCollapsed}>
                        <span className={`group-row__icon ${isCollapsed ? 'is-collapsed' : ''}`} aria-hidden="true">{isCollapsed ? <IconFolder size={17} stroke={1.9} /> : <IconFolderOpen size={17} stroke={1.9} />}</span>
                        <span className="group-row__label">
                          <span className="group-row__name">{group.name || copy.defaultGroupName}</span>
                          <span className="group-row__progress" aria-label={`${completedCount} / ${items.length}`}><span style={{ width: `${progress}%` }} /></span>
                        </span>
                        <span className="group-row__count">{items.length}</span>
                      </button>
                    )}

                    {!isDefaultGroup ? (
                      <div className="group-row__actions">
                        <button type="button" className="group-row__menu" onClick={() => { setMenuGroupId((current) => (current === group.id ? null : group.id)); setIsCreateMenuOpen(false); }} disabled={saving} aria-label={`${group.name} ${copy.renameGroup} / ${copy.deleteGroup}`} aria-expanded={menuGroupId === group.id}>
                          <IconDots size={15} stroke={2.1} />
                        </button>
                        {menuGroupId === group.id ? (
                          <div className="group-row__dropdown">
                            <button type="button" className="group-row__dropdown-item" onClick={() => { setEditingGroupId(group.id); setEditingGroupName(group.name); setMenuGroupId(null); }}><IconPencil size={13} stroke={2} aria-hidden="true" />{copy.renameGroup}</button>
                            <button type="button" className="group-row__dropdown-item is-danger" onClick={() => { onRequestDeleteGroup(group); setMenuGroupId(null); }}><IconTrash size={13} stroke={2} aria-hidden="true" />{copy.deleteGroup}</button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className={`group-section__todos ${isCollapsed ? 'is-collapsed' : ''}`}>
                    {items.length === 0 ? <p className="group-empty">{copy.emptyGroup}</p> : null}
                    {items.map((todo) => (
                      <div key={todo.id} className={`todo-row is-priority-${todo.priority} ${selectedId === todo.id ? 'is-active' : ''} ${todo.isCompleted ? 'is-completed' : ''}`}>
                        <button type="button" className={`check-circle ${todo.isCompleted ? 'is-completed' : ''}`} disabled={togglingTodoIds.includes(todo.id)} aria-busy={togglingTodoIds.includes(todo.id)} onClick={() => onToggleCompleted(todo)} aria-label={todo.title} aria-pressed={todo.isCompleted}>
                          {todo.isCompleted ? <IconCheck size={9} stroke={2.8} /> : null}
                        </button>
                        <button ref={(node) => onRegisterTodoRef(todo.id, node)} type="button" className="todo-row__main" onClick={() => onSelectTodo(todo)}>
                          <span className="todo-row__content">
                            <strong>{todo.title || copy.untitledTodo}</strong>
                            {todo.summary ? <span>{todo.summary}</span> : null}
                          </span>
                          <span className="todo-row__meta">
                            {todo.isFavorite ? <IconStarFilled className="todo-row__favorite" size={13} aria-hidden="true" /> : null}
                            <span
                              className={`todo-row__priority is-${todo.priority}`}
                              title={copy.priorities[todo.priority]}
                              aria-label={`${copy.priorityLabel}: ${copy.priorities[todo.priority]}`}
                            >
                              <IconFlag3 size={13} stroke={1.8} aria-hidden="true" />
                            </span>
                            {todo.subitems.length ? <span className="todo-row__badge"><IconListCheck size={11} stroke={2} aria-hidden="true" />{todo.subitems.length}</span> : null}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <button type="button" className="note-create-button" onClick={onCreateNote} disabled={saving}><IconPlus size={17} stroke={2.2} aria-hidden="true" />{copy.newNote}</button>
          <div className="notes-panel__header">
            <span>{copy.notesTitle}</span>
            <div className="notes-panel__actions">
              <span className="notes-panel__count">{visibleNotes.length}</span>
              {renderFilterPopover()}
            </div>
          </div>
          <div className="note-list">
            {loading ? <p className="empty-state">{copy.loading}</p> : null}
            {!loading && notes.length === 0 ? <div className="note-list__empty"><IconFileText size={22} stroke={1.7} aria-hidden="true" /><p>{copy.emptyNotes}</p></div> : null}
            {!loading && notes.length > 0 && visibleNotes.length === 0 ? <div className="note-list__empty"><IconFileText size={22} stroke={1.7} aria-hidden="true" /><p>{copy.emptyNotes}</p></div> : null}
            {visibleNotes.map((note) => (
              <button key={note.id} type="button" className={`note-list__item ${selectedNoteId === note.id ? 'is-active' : ''}`} onClick={() => onSelectNote(note)}>
                <span className="note-list__glyph" aria-hidden="true"><IconFileText size={16} stroke={1.8} /></span>
                <span className="note-list__copy"><strong>{note.title || copy.untitledNote}</strong><span>{noteExcerpt(note, copy.emptyNotePreview)}</span></span>
                {note.isPinned || note.isFavorite ? (
                  <span className="note-list__states" aria-label={[note.isPinned ? copy.pin : '', note.isFavorite ? copy.favorite : ''].filter(Boolean).join(', ')}>
                    {note.isPinned ? <IconPinFilled className="note-list__state note-list__state--pinned" size={14} aria-hidden="true" /> : null}
                    {note.isFavorite ? <IconStarFilled className="note-list__state note-list__state--favorite" size={14} aria-hidden="true" /> : null}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </>
      )}

      <button type="button" className="sidebar-trash-button" onClick={onOpenTrash}>
        <IconTrash size={15} stroke={2} aria-hidden="true" />{copy.trash}
      </button>

    </aside>
  );
}
