import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCalendarMonth,
  IconDots,
  IconFolder,
  IconFolderOpen,
  IconPencil,
  IconPlus,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';
import type { Todo, TodoGroup } from '../../types';

type SidebarCopy = {
  setting: string;
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
};

type TodoSidebarProps = {
  remainingCountText: string;
  totalCountText: string;
  copy: SidebarCopy;
  quickTitle: string;
  isCalendarOpen: boolean;
  loading: boolean;
  saving: boolean;
  groups: TodoGroup[];
  todos: Todo[];
  selectedId: string | null;
  activeGroupId: string | null;
  onOpenSettings: () => void;
  onQuickTitleChange: (value: string) => void;
  onQuickCreate: () => void;
  onOpenCalendarBoard: () => void;
  onRegisterTodoRef: (id: string, node: HTMLButtonElement | null) => void;
  onSelectTodo: (todo: Todo) => void;
  onSelectGroup: (groupID: string) => void;
  onToggleCompleted: (todo: Todo) => void;
  onCreateGroup: (name: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  onRequestDeleteGroup: (group: TodoGroup) => void;
};

export function TodoSidebar({
  remainingCountText,
  totalCountText,
  copy,
  quickTitle,
  isCalendarOpen,
  loading,
  saving,
  groups,
  todos,
  selectedId,
  activeGroupId,
  onOpenSettings,
  onQuickTitleChange,
  onQuickCreate,
  onOpenCalendarBoard,
  onRegisterTodoRef,
  onSelectTodo,
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
    for (const group of groups) {
      entries.set(group.id, []);
    }

    for (const todo of todos) {
      if (!entries.has(todo.groupId)) {
        entries.set(todo.groupId, []);
      }
      entries.get(todo.groupId)?.push(todo);
    }

    return entries;
  }, [groups, todos]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!sidebarRef.current?.contains(event.target as Node)) {
        setMenuGroupId(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuGroupId(null);
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
    if (!nextName) {
      return;
    }
    onCreateGroup(nextName);
    setGroupName('');
    setIsAddingGroup(false);
  }

  function startRenameGroup(group: TodoGroup) {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  }

  function submitRenameGroup() {
    const nextName = editingGroupName.trim();
    if (!nextName || !editingGroupId) {
      setEditingGroupId(null);
      setEditingGroupName('');
      return;
    }
    onRenameGroup(editingGroupId, nextName);
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
        <div className="sidebar__meta">
          <span>{remainingCountText}</span>
          <span>{totalCountText}</span>
        </div>
        <button type="button" className="topbar-icon-link" onClick={onOpenSettings} title={copy.setting} aria-label={copy.setting}>
          <IconSettings size={16} stroke={2} />
        </button>
      </div>

      <div className="quick-entry">
        <span className="quick-entry__plus">
          <IconPlus size={16} stroke={2.2} />
        </span>
        <input
          value={quickTitle}
          onChange={(event) => onQuickTitleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && quickTitle.trim()) {
              onQuickCreate();
            }
          }}
          placeholder={copy.quickAddPlaceholder}
        />
      </div>

      <button type="button" className={`calendar-entry ${isCalendarOpen ? 'is-active' : ''}`} onClick={onOpenCalendarBoard}>
        <span className="calendar-entry__icon">
          <IconCalendarMonth size={18} stroke={2} />
        </span>
        <span className="calendar-entry__copy">
          <strong>{copy.calendarEntryTitle}</strong>
          <span>{copy.calendarEntryDescription}</span>
        </span>
      </button>

      <div className="group-panel">
        <div className="group-panel__header">
          <span>{copy.groupsTitle}</span>
          <button
            type="button"
            className="group-panel__add"
            onClick={() => {
              setIsAddingGroup((current) => !current);
              setGroupName('');
            }}
            title={copy.addGroup}
            aria-label={copy.addGroup}
          >
            <IconPlus size={16} stroke={2.2} />
          </button>
        </div>

        {isAddingGroup ? (
          <div className="group-creator">
            <input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  submitGroup();
                }
                if (event.key === 'Escape') {
                  setIsAddingGroup(false);
                  setGroupName('');
                }
              }}
              onBlur={() => {
                if (!groupName.trim()) {
                  setIsAddingGroup(false);
                }
              }}
              placeholder={copy.addGroupPlaceholder}
              autoFocus
            />
          </div>
        ) : null}
      </div>

      <div className="todo-list">
        {loading ? <p className="empty-state">{copy.loading}</p> : null}
        {!loading && groups.length === 0 ? <p className="empty-state">{copy.emptyTodos}</p> : null}

        {!loading &&
          groups.map((group) => {
            const items = groupedTodos.get(group.id) ?? [];
            const isDefaultGroup = group.id === 'default';
            const isEditingGroup = editingGroupId === group.id;
            const isCollapsed = collapsedGroupIds.includes(group.id);
            const isActiveGroup = activeGroupId === group.id;

            return (
              <section key={group.id} className="group-section">
                <div className={`group-row ${isActiveGroup ? 'is-focused' : ''}`}>
                  <button
                    type="button"
                    className="group-row__main"
                    onClick={() => toggleGroup(group.id)}
                  >
                    <span className={`group-row__icon ${isCollapsed ? 'is-collapsed' : ''}`}>
                      {isCollapsed ? <IconFolder size={17} stroke={1.9} /> : <IconFolderOpen size={17} stroke={1.9} />}
                    </span>
                    {isEditingGroup ? (
                      <input
                        className="group-row__input"
                        value={editingGroupName}
                        onChange={(event) => setEditingGroupName(event.target.value)}
                        onBlur={submitRenameGroup}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            submitRenameGroup();
                          }
                          if (event.key === 'Escape') {
                            setEditingGroupId(null);
                            setEditingGroupName('');
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <span className="group-row__name">{group.name || copy.defaultGroupName}</span>
                    )}
                    <span className="group-row__count">{items.length}</span>
                  </button>

                  {!isDefaultGroup ? (
                    <div className="group-row__actions">
                      <button
                        type="button"
                        className="group-row__menu"
                        onClick={() => setMenuGroupId((current) => (current === group.id ? null : group.id))}
                        disabled={saving}
                        aria-label="Group menu"
                      >
                        <IconDots size={15} stroke={2.1} />
                      </button>
                      {menuGroupId === group.id ? (
                        <div className="group-row__dropdown">
                          <button
                            type="button"
                            className="group-row__dropdown-item"
                            onClick={() => {
                              startRenameGroup(group);
                              setMenuGroupId(null);
                            }}
                            disabled={saving}
                          >
                            <span className="group-row__dropdown-icon">
                              <IconPencil size={13} stroke={2} />
                            </span>
                            {copy.renameGroup}
                          </button>
                          <button
                            type="button"
                            className="group-row__dropdown-item is-danger"
                            onClick={() => {
                              onRequestDeleteGroup(group);
                              setMenuGroupId(null);
                            }}
                            disabled={saving}
                          >
                            <span className="group-row__dropdown-icon is-delete">
                              <IconTrash size={13} stroke={2} />
                            </span>
                            {copy.deleteGroup}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className={`group-section__todos ${isCollapsed ? 'is-collapsed' : ''}`}>
                  {items.length === 0 ? <p className="group-empty">{copy.emptyGroup}</p> : null}

                  {items.map((todo) => (
                    <button
                      key={todo.id}
                      ref={(node) => onRegisterTodoRef(todo.id, node)}
                      type="button"
                      className={`todo-row ${selectedId === todo.id ? 'is-active' : ''} ${todo.isCompleted ? 'is-completed' : ''}`}
                      onClick={() => onSelectTodo(todo)}
                    >
                      <span
                        className={`check-circle ${todo.isCompleted ? 'is-completed' : ''}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleCompleted(todo);
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
              </section>
            );
          })}
      </div>
    </aside>
  );
}
