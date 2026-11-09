import {
  IconArchive,
  IconListCheck,
  IconPlus,
  IconStar,
  IconStarFilled,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { PendingSubitem, SaveStatus } from '../../appTypes';
import type { Note, Todo, TodoDraft, TodoGroup, TodoSubitem } from '../../types';
import { RelationPickerDialog } from '../relations/RelationPickerDialog';
import { TodoProperties } from './TodoProperties';
import type { TodoPropertiesCopy } from './TodoProperties';
import { SaveIndicator } from '../_primitives/SaveIndicator';

type DetailCopy = TodoPropertiesCopy & {
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
  contentPlaceholder: string;
  subitemsTitle: string;
  deleteSelectedSubitems: string;
  addSubitem: string;
  subitemPlaceholder: string;
  emptySubitems: string;
  untitledTodo: string;
  linkedNotesLabel: string;
  relationSearchPlaceholder: string;
  relationEmpty: string;
  relationSelectedCount: (count: number) => string;
  relationDone: string;
  close: string;
  untitledRelatedItem: string;
  favorite: string;
  archive: string;
  saveStatus: Record<SaveStatus, string>;
  retrySave: string;
};

type TodoDetailPaneProps = {
  error: string;
  selectedTodo: Todo | null;
  copy: DetailCopy;
  createdAtText: string;
  saveStatus: SaveStatus;
  isEditing: boolean;
  saving: boolean;
  isDeleting: boolean;
  draft: TodoDraft;
  groups: TodoGroup[];
  notes: Note[];
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
  onRetrySave: () => void;
  onDraftChange: (updater: (current: TodoDraft) => TodoDraft) => void;
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
  isDeleting,
  draft,
  groups,
  notes,
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
  onRetrySave,
  onDraftChange,
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
  const [isRelationPickerOpen, setIsRelationPickerOpen] = useState(false);
  const activeNoteIds = useMemo(() => draft.noteIds.filter((id) => notes.some((note) => note.id === id)), [draft.noteIds, notes]);
  const activeGroupName = useMemo(
    () => groups.find((group) => group.id === draft.groupId)?.name ?? selectedGroupName,
    [draft.groupId, groups, selectedGroupName],
  );

  const relationItems = useMemo(() => notes
    .filter((note) => !note.isArchived || draft.noteIds.includes(note.id))
    .map((note) => ({
      id: note.id,
      title: note.title || copy.untitledRelatedItem,
      description: note.contentMarkdown.replace(/\s+/g, ' ').trim().slice(0, 120) || undefined,
      keywords: [note.contentMarkdown, ...note.tags].join('\n'),
    })), [copy.untitledRelatedItem, draft.noteIds, notes]);

  return (
    <main className="detail-panel">
      {error ? <div className="error-banner">{error}</div> : null}

      {!selectedTodo ? (
        <div className="todo-blank-state">
          <span className="todo-blank-state__icon" aria-hidden="true">
            <IconListCheck size={22} stroke={1.8} />
          </span>
          <h2>{copy.blankTitle}</h2>
          <p>{copy.blankDescription}</p>
        </div>
      ) : (
        <>
          <div className="detail-toolbar">
            <span className="created-at">{createdAtText}</span>
            <div className="detail-toolbar__actions">
              {isEditing || saveStatus === 'failed' ? <SaveIndicator status={saveStatus} labels={copy.saveStatus} retryLabel={copy.retrySave} onRetry={onRetrySave} /> : null}
              <button
                type="button"
                className={`todo-state-button ${draft.isFavorite ? 'is-active is-favorite' : ''}`}
                onClick={() => onDraftChange((current) => ({ ...current, isFavorite: !current.isFavorite }))}
                aria-label={copy.favorite}
                title={copy.favorite}
                aria-pressed={draft.isFavorite}
              >
                {draft.isFavorite ? <IconStarFilled size={15} aria-hidden="true" /> : <IconStar size={15} stroke={2} aria-hidden="true" />}
              </button>
              <button
                type="button"
                className={`todo-state-button ${draft.isArchived ? 'is-active' : ''}`}
                onClick={() => onDraftChange((current) => ({ ...current, isArchived: !current.isArchived }))}
                aria-label={copy.archive}
                title={copy.archive}
                aria-pressed={draft.isArchived}
              >
                <IconArchive size={15} stroke={2} aria-hidden="true" />
              </button>
              {isEditing ? (
                <button type="button" className="topbar-link" onClick={onExitEditMode}>
                  {copy.exitEdit}
                </button>
              ) : (
                <button type="button" className="topbar-link" onClick={onEnterEditMode}>
                  {copy.edit}
                </button>
              )}
              <button type="button" className="topbar-link" onClick={onRequestDelete} disabled={isDeleting}>
                {copy.delete}
              </button>
            </div>
          </div>

          {isEditing ? (
            <>
              <section className="detail-section todo-edit-section">
                <div className="todo-edit-identity">
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
                </div>

                <TodoProperties
                  key={selectedTodo.id}
                  linkedNoteCount={activeNoteIds.length}
                  draft={draft}
                  groups={groups}
                  groupName={activeGroupName}
                  dueDateText={formattedDraftDueDate}
                  copy={copy}
                  onDraftChange={onDraftChange}
                  onOpenRelations={() => setIsRelationPickerOpen(true)}
                />
              </section>

              <section className="detail-section">
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
                  placeholder={copy.contentPlaceholder}
                  aria-label={copy.contentPlaceholder}
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
                              if (event.nativeEvent.isComposing || event.keyCode === 229) return;
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
                          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
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
                  <div className="detail-static__chips">
                    <span className={`detail-priority-chip is-${selectedTodo.priority}`}>
                      {copy.priorities[selectedTodo.priority]}
                    </span>
                    {selectedTodo.tags.map((tag) => <span key={tag}>#{tag}</span>)}
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
          <RelationPickerDialog
            isOpen={isRelationPickerOpen}
            title={copy.linkedNotesLabel}
            searchPlaceholder={copy.relationSearchPlaceholder}
            emptyText={copy.relationEmpty}
            selectedCountText={copy.relationSelectedCount(activeNoteIds.length)}
            closeLabel={copy.close}
            doneLabel={copy.relationDone}
            items={relationItems}
            selectedIds={activeNoteIds}
            onToggle={(noteId) => onDraftChange((current) => ({
              ...current,
              noteIds: current.noteIds.includes(noteId)
                ? current.noteIds.filter((id) => id !== noteId)
                : [...current.noteIds, noteId],
            }))}
            onClose={() => setIsRelationPickerOpen(false)}
          />
        </>
      )}
    </main>
  );
}
