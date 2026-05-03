import type { Todo } from '../../types';

type CalendarView = 'month' | 'week';

type CalendarCell = {
  key: string;
  dayNumber?: number;
  isBlank: boolean;
  isToday?: boolean;
  isSelected?: boolean;
  badgeCount?: number;
  hasPending?: boolean;
};

type CalendarCopy = {
  title: string;
  monthView: string;
  weekView: string;
  today: string;
  close: string;
  untitledTodo: string;
  noSummary: string;
  noScheduledTodos: string;
};

type CalendarModalProps = {
  isOpen: boolean;
  copy: CalendarCopy;
  view: CalendarView;
  weekdayLabels: string[];
  selectedDateTitle: string;
  selectedDateTodos: Todo[];
  cells: CalendarCell[];
  onClose: () => void;
  onViewChange: (view: CalendarView) => void;
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
  onSelectDate: (key: string) => void;
  onOpenTodo: (todo: Todo) => void;
};

export function CalendarModal({
  isOpen,
  copy,
  view,
  weekdayLabels,
  selectedDateTitle,
  selectedDateTodos,
  cells,
  onClose,
  onViewChange,
  onPrevious,
  onToday,
  onNext,
  onSelectDate,
  onOpenTodo,
}: CalendarModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="calendar-modal" onClick={(event) => event.stopPropagation()}>
        <div className="calendar-modal__header">
          <div className="calendar-toolbar__title">
            <h2>{copy.title}</h2>
          </div>
          <div className="calendar-toolbar__actions">
            <div className="calendar-view-switch">
              <button
                type="button"
                className={`calendar-view-switch__button ${view === 'month' ? 'is-active' : ''}`}
                onClick={() => onViewChange('month')}
              >
                {copy.monthView}
              </button>
              <button
                type="button"
                className={`calendar-view-switch__button ${view === 'week' ? 'is-active' : ''}`}
                onClick={() => onViewChange('week')}
              >
                {copy.weekView}
              </button>
            </div>
            <button type="button" className="topbar-link" onClick={onPrevious} aria-label={copy.close}>
              ‹
            </button>
            <button type="button" className="topbar-link" onClick={onToday}>
              {copy.today}
            </button>
            <button type="button" className="topbar-link" onClick={onNext} aria-label={copy.close}>
              ›
            </button>
            <button type="button" className="icon-button" onClick={onClose} aria-label={copy.close}>
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

            <div className={`calendar-grid calendar-grid--body ${view === 'month' ? 'is-month' : 'is-week'}`}>
              {cells.map((cell) => {
                if (cell.isBlank) {
                  return <div key={cell.key} className="calendar-cell calendar-cell--blank" />;
                }

                return (
                  <button
                    key={cell.key}
                    type="button"
                    className={`calendar-cell calendar-cell--day ${cell.isToday ? 'is-today' : ''} ${cell.isSelected ? 'is-selected' : ''}`}
                    onClick={() => onSelectDate(cell.key)}
                  >
                    <div className="calendar-cell__daynum">{cell.dayNumber}</div>
                    {cell.badgeCount ? (
                      <span className={`calendar-cell__badge ${cell.hasPending ? 'is-danger' : 'is-success'}`}>
                        {cell.badgeCount}
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
                    onClick={() => onOpenTodo(todo)}
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
  );
}
