import type { Todo } from '../../types';

type SidebarCopy = {
  setting: string;
  quickAddPlaceholder: string;
  calendarEntryTitle: string;
  calendarEntryDescription: string;
  loading: string;
  emptyTodos: string;
  untitledTodo: string;
  noSummary: string;
};

type TodoSidebarProps = {
  remainingCountText: string;
  totalCountText: string;
  copy: SidebarCopy;
  quickTitle: string;
  isCalendarOpen: boolean;
  loading: boolean;
  todos: Todo[];
  selectedId: string | null;
  onOpenSettings: () => void;
  onQuickTitleChange: (value: string) => void;
  onQuickCreate: () => void;
  onOpenCalendarBoard: () => void;
  onRegisterTodoRef: (id: string, node: HTMLButtonElement | null) => void;
  onSelectTodo: (todo: Todo) => void;
  onToggleCompleted: (todo: Todo) => void;
};

export function TodoSidebar({
  remainingCountText,
  totalCountText,
  copy,
  quickTitle,
  isCalendarOpen,
  loading,
  todos,
  selectedId,
  onOpenSettings,
  onQuickTitleChange,
  onQuickCreate,
  onOpenCalendarBoard,
  onRegisterTodoRef,
  onSelectTodo,
  onToggleCompleted,
}: TodoSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__topbar">
        <div className="sidebar__meta">
          <span>{remainingCountText}</span>
          <span>{totalCountText}</span>
        </div>
        <button type="button" className="topbar-link" onClick={onOpenSettings} title={copy.setting}>
          {copy.setting}
        </button>
      </div>

      <div className="quick-entry">
        <span className="quick-entry__plus">+</span>
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
    </aside>
  );
}
