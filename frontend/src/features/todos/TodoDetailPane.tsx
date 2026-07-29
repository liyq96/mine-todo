import { IconChevronDown, IconFolder, IconPlus, IconX } from '@tabler/icons-react';
import * as Popover from '@radix-ui/react-popover';
import { useMemo } from 'react';
import type { PendingSubitem, SaveStatus } from '../../appTypes';
import type { Todo, TodoDraft, TodoGroup, TodoSubitem } from '../../types';

type DetailCopy = {
  blankTitle: string;
  blankDescription: string;
  exitEdit: string;
  edit: string;
  delete: string;
  titlePlaceholder: string;
  summaryPlaceholder: string;
  groupLabel: string;
  dueDateLabel: string;
  dueDateNone: string;
  clearDate: string;
  markdown: string;
  markdownPlaceholder: string;
  subitemsTitle: string;
  deleteSelectedSubitems: string;
  addSubitem: string;
  subitemPlaceholder: string;
  emptySubitems: string;
  untitledTodo: string;
  saveStatus: Record<SaveStatus, string>;
};

type TodoDetailPaneProps = {
  error: string;
  selectedTodo: Todo | null;
  copy: DetailCopy;
  createdAtText: string;
  saveStatus: SaveStatus;
  isEditing: boolean;
  saving: boolean;
  draft: TodoDraft;
  groups: TodoGroup[];
  selectedGroupName: string;
  detailHTML: string;
  visibleSubitems: TodoSubitem[];
  pendingSubitems: PendingSubitem[];
  selectedSubitemIds: string[];
  editingSubitemId: string | null;
  editingSubitemContent: string;
  onExitEditMode: () => void;
  onEnterEditMode: () => void;
  onRequestDelete: () => void;
  onDraftChange: (updater: (current: TodoDraft) => TodoDraft) => void;
  onDraftGroupChange: (groupId: string) => void;
  onOpenDueDatePicker: () => void;
  onDeleteSelectedSubitems: () => void;
  onAddSubitemInput: () => void;
  onToggleSubitemSelection: (id: string) => void;
  onStartEditingSubitem: (subitem: TodoSubitem) => void;
  onEditingSubitemContentChange: (value: string) => void;
  onCommitEditingSubitem: () => void;
  onCancelEditingSubitem: () => void;
  onPendingSubitemChange: (id: string, content: string) => void;
  onCommitPendingSubitem: (id: string) => void;
  onRemovePendingSubitem: (id: string) => void;
  onToggleSubitemCompleted: (subitem: TodoSubitem) => void;
  formattedDraftDueDate: string;
  formattedSelectedDueDate: string;
};

export function TodoDetailPane({
  error,
  selectedTodo,
  copy,
  createdAtText,
  saveStatus,
  isEditing,
  saving,
  draft,
  groups,
  selectedGroupName,
  detailHTML,
  visibleSubitems,
  pendingSubitems,
  selectedSubitemIds,
  editingSubitemId,
  editingSubitemContent,
  onExitEditMode,
  onEnterEditMode,
  onRequestDelete,
  onDraftChange,
  onDraftGroupChange,
  onOpenDueDatePicker,
  onDeleteSelectedSubitems,
  onAddSubitemInput,
  onToggleSubitemSelection,
  onStartEditingSubitem,
  onEditingSubitemContentChange,
  onCommitEditingSubitem,
  onCancelEditingSubitem,
  onPendingSubitemChange,
  onCommitPendingSubitem,
  onRemovePendingSubitem,
  onToggleSubitemCompleted,
  formattedDraftDueDate,
  formattedSelectedDueDate,
}: TodoDetailPaneProps) {
  const activeGroupName = useMemo(
    () => groups.find((group) => group.id === draft.groupId)?.name ?? selectedGroupName,
    [draft.groupId, groups, selectedGroupName],
  );

  return (
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
            <span className="created-at">{createdAtText}</span>
            <div className="detail-toolbar__actions">
              {isEditing ? <span className="save-hint">{copy.saveStatus[saveStatus]}</span> : null}
              {isEditing ? (
                <button type="button" className="topbar-link" onClick={onExitEditMode}>
                  {copy.exitEdit}
                </button>
              ) : (
                <button type="button" className="topbar-link" onClick={onEnterEditMode}>
                  {copy.edit}
                </button>
              )}
              <button type="button" className="topbar-link" onClick={onRequestDelete} disabled={saving}>
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
                  onChange={(event) => onDraftChange((current) => ({ ...current, title: event.target.value }))}
                  placeholder={copy.titlePlaceholder}
                />
                <textarea
                  className="summary-input"
                  rows={2}
                  value={draft.summary}
                  onChange={(event) => onDraftChange((current) => ({ ...current, summary: event.target.value }))}
                  placeholder={copy.summaryPlaceholder}
                />
                <div className="detail-date-field">
                  <span>{copy.groupLabel}</span>
                  <div className="detail-select-wrap">
                    <Popover.Root>
                      <Popover.Trigger asChild>
                        <button type="button" className="detail-group-picker">
                          <span className="detail-group-picker__value">
                            <IconFolder size={15} stroke={2} />
                            <strong>{activeGroupName}</strong>
                          </span>
                          <span className="detail-group-picker__icon">
                            <IconChevronDown size={14} stroke={2} />
                          </span>
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content className="detail-group-menu" align="start" sideOffset={6}>
                          {groups.map((group) => (
                            <button
                              key={group.id}
                              type="button"
                              className={`detail-group-menu__item ${draft.groupId === group.id ? 'is-active' : ''}`}
                              onClick={() => onDraftGroupChange(group.id)}
                            >
                              <span className="detail-group-menu__item-icon">
                                <IconFolder size={14} stroke={2} />
                              </span>
                              <span>{group.name}</span>
                            </button>
                          ))}
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  </div>
                </div>
                <div className="detail-date-field">
                  <span>{copy.dueDateLabel}</span>
                  <div className="detail-date-picker-row">
                    <button
                      type="button"
                      className="detail-date-picker"
                      onClick={onOpenDueDatePicker}
                    >
                      <span className={`detail-date-picker__value ${draft.dueDate ? 'has-value' : ''}`}>
                        <strong>{formattedDraftDueDate}</strong>
                      </span>
                      <span className="detail-date-picker__icon">
                        <IconChevronDown size={14} stroke={2} />
                      </span>
                    </button>
                    {draft.dueDate ? (
                      <button
                        type="button"
                        className="detail-date-picker__clear"
                        onClick={() => onDraftChange((current) => ({ ...current, dueDate: '' }))}
                        aria-label={copy.clearDate}
                        title={copy.clearDate}
                      >
                        <IconX size={14} stroke={2} />
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
                    onDraftChange((current) => ({
                      ...current,
                      detailMarkdown: event.target.value,
                    }))
                  }
                  placeholder={copy.markdownPlaceholder}
                />
              </section>

              <section className="detail-section preview-section">
                <div className="detail-section__header detail-section__header--subitems">
                  <h3>{copy.subitemsTitle}</h3>
                  <div className="subitems-toolbar">
                    <button
                      type="button"
                      className="topbar-link"
                      onClick={onDeleteSelectedSubitems}
                      disabled={saving || selectedSubitemIds.length === 0}
                    >
                      {copy.deleteSelectedSubitems}
                    </button>
                    <button
                      type="button"
                      className="subitem-add-button"
                      onClick={onAddSubitemInput}
                      disabled={saving}
                      aria-label={copy.addSubitem}
                      title={copy.addSubitem}
                    >
                      <IconPlus size={16} stroke={2.4} />
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
                      <div
                        key={subitem.id}
                        className={`subitem-row is-editing ${isSelected ? 'is-selected' : ''} ${subitem.isCompleted ? 'is-completed' : ''}`}
                      >
                        <label className="subitem-select">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSubitemSelection(subitem.id)}
                          />
                          <span className="subitem-checkbox">{isSelected ? '✓' : ''}</span>
                        </label>
                        {isEditingSubitem ? (
                          <input
                            className="subitem-input"
                            value={editingSubitemContent}
                            onChange={(event) => onEditingSubitemContentChange(event.target.value)}
                            onBlur={() => void onCommitEditingSubitem()}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                void onCommitEditingSubitem();
                              }
                              if (event.key === 'Escape') {
                                onCancelEditingSubitem();
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            className="subitem-content-button"
                            onClick={() => onStartEditingSubitem(subitem)}
                          >
                            <span className="subitem-content">{subitem.content}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {pendingSubitems.map((item, index) => (
                    <div key={item.id} className="subitem-row is-pending">
                      <span className="subitem-checkbox is-pending" />
                      <input
                        className="subitem-input"
                        value={item.content}
                        onChange={(event) => onPendingSubitemChange(item.id, event.target.value)}
                        onBlur={() => void onCommitPendingSubitem(item.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void onCommitPendingSubitem(item.id);
                          }
                          if (event.key === 'Escape') {
                            onRemovePendingSubitem(item.id);
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
                    <span>{copy.groupLabel}</span>
                    <strong>{selectedGroupName}</strong>
                  </div>
                  <div className="detail-date-display">
                    <span>{copy.dueDateLabel}</span>
                    <strong>{formattedSelectedDueDate}</strong>
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
                      onClick={() => onToggleSubitemCompleted(subitem)}
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
  );
}
