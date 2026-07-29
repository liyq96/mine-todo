import { Modal } from '../_primitives/Modal';

type DueDatePickerCell = {
  key: string;
  dayNumber?: number;
  isBlank: boolean;
  isSelected?: boolean;
  isToday?: boolean;
  value?: string;
};

type DueDatePickerModalProps = {
  isOpen: boolean;
  title: string;
  monthLabel: string;
  todayLabel: string;
  clearLabel: string;
  cancelLabel: string;
  closeLabel: string;
  weekdayLabels: string[];
  cells: DueDatePickerCell[];
  onClose: () => void;
  onPreviousMonth: () => void;
  onToday: () => void;
  onNextMonth: () => void;
  onPickDate: (value: string) => void;
  onClear: () => void;
};

export function DueDatePickerModal({
  isOpen,
  title,
  monthLabel,
  todayLabel,
  clearLabel,
  cancelLabel,
  closeLabel,
  weekdayLabels,
  cells,
  onClose,
  onPreviousMonth,
  onToday,
  onNextMonth,
  onPickDate,
  onClear,
}: DueDatePickerModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose} contentClassName="due-date-modal">
      <div className="due-date-modal__header">
        <div className="calendar-toolbar__title">
          <h2>{title}</h2>
          <span className="created-at">{monthLabel}</span>
        </div>
        <div className="calendar-toolbar__actions">
          <button type="button" className="topbar-link" onClick={onPreviousMonth} aria-label={closeLabel}>
            ‹
          </button>
          <button type="button" className="topbar-link" onClick={onToday}>
            {todayLabel}
          </button>
          <button type="button" className="topbar-link" onClick={onNextMonth} aria-label={closeLabel}>
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
          {cells.map((cell) => {
            if (cell.isBlank) {
              return <div key={cell.key} className="calendar-cell calendar-cell--blank compact" />;
            }

            return (
              <button
                key={cell.key}
                type="button"
                className={`calendar-cell calendar-cell--day compact ${cell.isSelected ? 'is-selected' : ''} ${cell.isToday ? 'is-today' : ''}`}
                onClick={() => cell.value && onPickDate(cell.value)}
              >
                <div className="calendar-cell__daynum">{cell.dayNumber}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="due-date-modal__footer">
        <button type="button" className="topbar-link" onClick={onClear}>
          {clearLabel}
        </button>
        <button type="button" className="topbar-link" onClick={onClose}>
          {cancelLabel}
        </button>
      </div>
    </Modal>
  );
}