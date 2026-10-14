import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCalendarMonth,
  IconCheck,
  IconChevronRight,
  IconDots,
  IconFileText,
  IconFolder,
  IconFolderOpen,
  IconListCheck,
  IconNote,
  IconPencil,
  IconPlus,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';
import type { WorkspaceMode } from '../../appTypes';
import type { Note, Todo, TodoGroup } from '../../types';

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
  noSummary: string;
  groupsTitle: string;
  addGroup: string;
  addGroupPlaceholder: string;
  emptyGroup: string;
  renameGroup: string;
  deleteGroup: string;
  defaultGroupName: string;
  notesTitle: string;
  newNote: string;
  emptyNotes: string;
  untitledNote: string;
  emptyNotePreview: string;
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
  onRenameGroup: (id: string, name: string) => void;
  onRequestDeleteGroup: (group: TodoGroup) => void;
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
  onRenameGroup,
  onRequestDeleteGroup,
}: TodoSidebarProps) {
  const sidebarRef = useRef<HTMLElement | null>(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>([]);
  const [menuGroupId, setMenuGroupId] = useState<string | null>(null);

  const groupedTodos = useMemo(() => {
    const entries = new Map<string, Todo[]>();
    for (const group of groups) entries.set(group.id, []);
    for (const todo of todos) {
      if (!entries.has(todo.groupId)) entries.set(todo.groupId, []);
      entries.get(todo.groupId)?.push(todo);
    }
    return entries;
  }, [groups, todos]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!sidebarRef.current?.contains(event.target as Node)) setMenuGroupId(null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuGroupId(null);
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
        <button type="button" className={`workspace-switch__button ${mode === 'todos' ? 'is-active' : ''}`} onClick={() => onModeChange('todos')} aria-current={mode === 'todos' ? 'page' : undefined}>
          <IconListCheck size={16} stroke={2} aria-hidden="true" />{copy.todoTab}
        </button>
        <button type="button" className={`workspace-switch__button ${mode === 'notes' ? 'is-active' : ''}`} onClick={() => onModeChange('notes')} aria-current={mode === 'notes' ? 'page' : undefined}>
          <IconNote size={16} stroke={2} aria-hidden="true" />{copy.noteTab}
        </button>
      </nav>

      {mode === 'todos' ? (
        <>
          <div className="quick-entry">
            <span className="quick-entry__plus" aria-hidden="true"><IconPlus size={16} stroke={2.2} /></span>
            <input value={quickTitle} onChange={(event) => onQuickTitleChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && quickTitle.trim()) onQuickCreate(); }} placeholder={copy.quickAddPlaceholder} aria-label={copy.quickAddPlaceholder} />
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
              <button type="button" className="group-panel__add" onClick={() => { setIsAddingGroup((current) => !current); setGroupName(''); }} title={copy.addGroup} aria-label={copy.addGroup}>
                <IconPlus size={16} stroke={2.2} />
              </button>
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
            {!loading && groups.map((group) => {
              const items = groupedTodos.get(group.id) ?? [];
              const completedCount = items.filter((item) => item.isCompleted).length;
              const progress = items.length ? Math.round((completedCount / items.length) * 100) : 0;
              const isDefaultGroup = group.id === 'default';
              const isEditingGroup = editingGroupId === group.id;
              const isCollapsed = collapsedGroupIds.includes(group.id);
              const isActiveGroup = activeGroupId === group.id;

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
                        <button type="button" className="group-row__menu" onClick={() => setMenuGroupId((current) => (current === group.id ? null : group.id))} disabled={saving} aria-label={`${group.name} ${copy.renameGroup} / ${copy.deleteGroup}`} aria-expanded={menuGroupId === group.id}>
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
                      <div key={todo.id} className={`todo-row ${selectedId === todo.id ? 'is-active' : ''} ${todo.isCompleted ? 'is-completed' : ''}`}>
                        <button type="button" className={`check-circle ${todo.isCompleted ? 'is-completed' : ''}`} onClick={() => onToggleCompleted(todo)} aria-label={todo.title} aria-pressed={todo.isCompleted}>
                          {todo.isCompleted ? <IconCheck size={12} stroke={2.6} /> : null}
                        </button>
                        <button ref={(node) => onRegisterTodoRef(todo.id, node)} type="button" className="todo-row__main" onClick={() => onSelectTodo(todo)}>
                          <span className="todo-row__content"><strong>{todo.title || copy.untitledTodo}</strong><span>{todo.summary || copy.noSummary}</span></span>
                          {todo.subitems.length ? <span className="todo-row__badge">{todo.subitems.length}</span> : null}
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
          <div className="notes-panel__header"><span>{copy.notesTitle}</span><span>{notes.length}</span></div>
          <div className="note-list">
            {loading ? <p className="empty-state">{copy.loading}</p> : null}
            {!loading && notes.length === 0 ? <div className="note-list__empty"><IconFileText size={22} stroke={1.7} aria-hidden="true" /><p>{copy.emptyNotes}</p></div> : null}
            {notes.map((note) => (
              <button key={note.id} type="button" className={`note-list__item ${selectedNoteId === note.id ? 'is-active' : ''}`} onClick={() => onSelectNote(note)}>
                <span className="note-list__glyph" aria-hidden="true"><IconFileText size={16} stroke={1.8} /></span>
                <span className="note-list__copy"><strong>{note.title || copy.untitledNote}</strong><span>{noteExcerpt(note, copy.emptyNotePreview)}</span></span>
              </button>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
