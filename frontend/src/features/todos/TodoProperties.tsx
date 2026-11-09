import { IconBell, IconCalendarEvent, IconCheck, IconChevronDown, IconFlag3, IconFolder, IconLink, IconX } from '@tabler/icons-react';
import { useId, useState } from 'react';
import { fromLocalDateTimeInput, toLocalDateTimeInput } from '../../lib/date';
import { TODO_PRIORITIES } from '../../lib/priorities';
import { parseTags } from '../../lib/productivity';
import { AnchoredPopover } from '../_primitives/AnchoredPopover';
import { CommandDialog } from '../_primitives/CommandDialog';
import { TagInput, TagList } from '../tags/TagControls';
import type { TodoDraft, TodoGroup, TodoPriority } from '../../types';

export type TodoPropertiesCopy = {
  priorityLabel: string;
  priorities: Record<TodoPriority, string>;
  groupLabel: string;
  scheduleLabel: string;
  scheduleDescription: string;
  dueDateLabel: string;
  reminderLabel: string;
  clearSchedule: string;
  applySchedule: string;
  cancel: string;
  close: string;
  tagsLabel: string;
  tagInputPlaceholder: string;
  removeTag: (tag: string) => string;
  linkedNotesLabel: string;
};

type TodoPropertiesProps = {
  linkedNoteCount: number;
  draft: TodoDraft;
  groups: TodoGroup[];
  groupName: string;
  dueDateText: string;
  copy: TodoPropertiesCopy;
  onDraftChange: (updater: (current: TodoDraft) => TodoDraft) => void;
  onOpenRelations: () => void;
};

export function TodoProperties({ draft, groups, groupName, dueDateText, copy, onDraftChange, onOpenRelations, linkedNoteCount }: TodoPropertiesProps) {
  const [openMenu, setOpenMenu] = useState<'priority' | 'group' | null>(null);
  const [isTimeOpen, setIsTimeOpen] = useState(false);
  const hasSchedule = Boolean(draft.dueDate || draft.reminderAt);

  return (
    <div className="todo-properties">
      <div className="todo-properties__bar">
        <AnchoredPopover
          open={openMenu === 'priority'}
          onOpenChange={(open) => setOpenMenu(open ? 'priority' : null)}
          align="start"
          contentClassName="todo-property-menu"
          ariaLabel={copy.priorityLabel}
          trigger={(
            <button type="button" className={`todo-property-button is-priority-${draft.priority}`} aria-label={`${copy.priorityLabel}: ${copy.priorities[draft.priority]}`}>
              <IconFlag3 className="todo-priority-glyph" size={16} stroke={1.8} aria-hidden="true" />
              <span>{copy.priorities[draft.priority]}</span>
              <IconChevronDown className="todo-property-button__chevron" size={12} aria-hidden="true" />
            </button>
          )}
        >
          <p className="todo-property-menu__label">{copy.priorityLabel}</p>
          {TODO_PRIORITIES.map((priority) => (
            <button key={priority} type="button" role="menuitemradio" aria-checked={draft.priority === priority}
              className={`todo-property-menu__option is-priority-${priority} ${draft.priority === priority ? 'is-active' : ''}`}
              onClick={() => { onDraftChange((current) => ({ ...current, priority })); setOpenMenu(null); }}>
              <IconFlag3 className="todo-priority-glyph" size={17} stroke={1.8} aria-hidden="true" />
              <span>{copy.priorities[priority]}</span>
              {draft.priority === priority ? <IconCheck size={14} aria-hidden="true" /> : <span />}
            </button>
          ))}
        </AnchoredPopover>

        <AnchoredPopover
          open={openMenu === 'group'}
          onOpenChange={(open) => setOpenMenu(open ? 'group' : null)}
          align="start"
          contentClassName="todo-property-menu"
          ariaLabel={copy.groupLabel}
          trigger={(
            <button type="button" className="todo-property-button" aria-label={`${copy.groupLabel}: ${groupName}`} title={groupName}>
              <IconFolder size={16} stroke={1.8} aria-hidden="true" />
              <span>{groupName}</span>
              <IconChevronDown className="todo-property-button__chevron" size={12} aria-hidden="true" />
            </button>
          )}
        >
          <p className="todo-property-menu__label">{copy.groupLabel}</p>
          {groups.map((group) => (
            <button key={group.id} type="button" role="menuitemradio" aria-checked={draft.groupId === group.id}
              className={`todo-property-menu__option todo-property-menu__option--group ${draft.groupId === group.id ? 'is-active' : ''}`}
              onClick={() => { onDraftChange((current) => ({ ...current, groupId: group.id })); setOpenMenu(null); }}>
              <IconFolder size={16} stroke={1.8} aria-hidden="true" />
              <span>{group.name}</span>
              {draft.groupId === group.id ? <IconCheck size={14} aria-hidden="true" /> : <span />}
            </button>
          ))}
        </AnchoredPopover>

        <button type="button" className={`todo-property-button ${hasSchedule ? 'has-value' : ''}`} onClick={() => setIsTimeOpen(true)}
          aria-label={copy.scheduleLabel} aria-haspopup="dialog" aria-expanded={isTimeOpen}>
          <IconCalendarEvent size={16} stroke={1.8} aria-hidden="true" />
          <span>{draft.dueDate ? dueDateText : copy.scheduleLabel}</span>
          {draft.reminderAt ? <IconBell size={13} aria-label={copy.reminderLabel} /> : null}
        </button>

        <TagInput label={copy.tagsLabel} placeholder={copy.tagInputPlaceholder}
          onAdd={(tags) => onDraftChange((current) => ({ ...current, tags: parseTags([...current.tags, ...tags].join(',')) }))} />

        <button type="button" className="todo-property-button" onMouseDown={(event) => event.preventDefault()} onClick={(event) => { event.currentTarget.focus(); onOpenRelations(); }} aria-haspopup="dialog">
          <IconLink size={16} stroke={1.8} aria-hidden="true" /><span>{copy.linkedNotesLabel}</span>
          {linkedNoteCount ? <span className="todo-property-button__count">{linkedNoteCount}</span> : null}
        </button>
      </div>

      <TagList tags={draft.tags} label={copy.tagsLabel} removeLabel={copy.removeTag}
        onRemove={(tag) => onDraftChange((current) => ({ ...current, tags: current.tags.filter((value) => value !== tag) }))} />

      {isTimeOpen ? <TodoScheduleDialog draft={draft} copy={copy} onClose={() => setIsTimeOpen(false)} onDraftChange={onDraftChange} /> : null}
    </div>
  );
}

function TodoScheduleDialog({ draft, copy, onClose, onDraftChange }: Pick<TodoPropertiesProps, 'draft' | 'copy' | 'onDraftChange'> & { onClose: () => void }) {
  const fieldId = useId();
  const [dueDate, setDueDate] = useState(draft.dueDate);
  const [reminderAt, setReminderAt] = useState(toLocalDateTimeInput(draft.reminderAt));

  function handleApply() {
    if (reminderAt && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
    onDraftChange((current) => ({ ...current, dueDate, reminderAt: fromLocalDateTimeInput(reminderAt) }));
    onClose();
  }

  return (
    <CommandDialog open title={copy.scheduleLabel} contentClassName="todo-schedule-dialog" overlayClassName="modal-backdrop todo-schedule-backdrop" onClose={onClose}>
      <header className="todo-schedule-dialog__header">
        <div><h2>{copy.scheduleLabel}</h2><p>{copy.scheduleDescription}</p></div>
        <button type="button" className="todo-schedule-dialog__close" aria-label={copy.close} onClick={onClose}><IconX size={18} aria-hidden="true" /></button>
      </header>
      <form onSubmit={(event) => { event.preventDefault(); handleApply(); }}>
        <div className="todo-schedule-dialog__fields">
          <div className="todo-schedule-field">
            <label htmlFor={`${fieldId}-due`}><IconCalendarEvent size={17} stroke={1.8} aria-hidden="true" />{copy.dueDateLabel}</label>
            <input id={`${fieldId}-due`} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
          <div className="todo-schedule-field">
            <label htmlFor={`${fieldId}-reminder`}><IconBell size={17} stroke={1.8} aria-hidden="true" />{copy.reminderLabel}</label>
            <input id={`${fieldId}-reminder`} type="datetime-local" value={reminderAt} onChange={(event) => setReminderAt(event.target.value)} />
          </div>
        </div>
        <footer className="todo-schedule-dialog__footer">
          <button type="button" className="todo-schedule-dialog__clear" onClick={() => { setDueDate(''); setReminderAt(''); }}>{copy.clearSchedule}</button>
          <button type="button" className="todo-schedule-dialog__cancel" onClick={onClose}>{copy.cancel}</button>
          <button type="submit" className="todo-schedule-dialog__apply">{copy.applySchedule}</button>
        </footer>
      </form>
    </CommandDialog>
  );
}
