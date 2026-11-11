import { IconArchive, IconBook2, IconEdit, IconEye, IconLink, IconPin, IconPinFilled, IconPlus, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useNoteEditorLayout } from '../../hooks/useNoteEditorLayout';
import type { SaveStatus } from '../../appTypes';
import { parseTags } from '../../lib/productivity';
import type { Note, NoteDraft, Todo } from '../../types';
import { RelationPickerDialog } from '../relations/RelationPickerDialog';
import { TagInput, TagList } from '../tags/TagControls';
import { SaveIndicator } from '../_primitives/SaveIndicator';
import { NoteTransferMenu } from './NoteTransferMenu';
import type { NoteTransferCopy } from './NoteTransferMenu';

type NoteEditorCopy = {
  blankTitle: string;
  blankDescription: string;
  createNote: string;
  titlePlaceholder: string;
  contentPlaceholder: string;
  editMode: string;
  previewMode: string;
  deleteNote: string;
  transfer: NoteTransferCopy;
  characterCount: (count: number) => string;
  updatedAt: (value: string) => string;
  tagsLabel: string;
  tagInputPlaceholder: string;
  removeTag: (tag: string) => string;
  linkedTodosLabel: string;
  relationSearchPlaceholder: string;
  relationEmpty: string;
  relationSelectedCount: (count: number) => string;
  relationDone: string;
  close: string;
  untitledRelatedItem: string;
  backlinksLabel: string;
  pin: string;
  favorite: string;
  archive: string;
  saveStatus: Record<SaveStatus, string>;
  retrySave: string;
};

type NoteEditorPaneProps = {
  error: string;
  selectedNote: Note | null;
  todos: Todo[];
  backlinks: Note[];
  draft: NoteDraft;
  saveStatus: SaveStatus;
  isPreview: boolean;
  saving: boolean;
  previewHTML: string;
  locale: string;
  copy: NoteEditorCopy;
  onDraftChange: (updater: (current: NoteDraft) => NoteDraft) => void;
  onPreviewChange: (value: boolean) => void;
  onCreateNote: () => void;
  onRequestDelete: () => void;
  onExportDocument: (format: 'markdown' | 'docx' | 'pdf') => void;
  onImportMarkdown: () => void;
  onRetrySave: () => void;
  onSelectTodo: (todo: Todo) => void;
  onSelectNote: (note: Note) => void;
  onOpenNoteLink: (id: string) => void;
};

export function NoteEditorPane({
  error,
  selectedNote,
  todos,
  backlinks,
  draft,
  saveStatus,
  isPreview,
  saving,
  previewHTML,
  locale,
  copy,
  onDraftChange,
  onPreviewChange,
  onCreateNote,
  onRequestDelete,
  onExportDocument,
  onImportMarkdown,
  onRetrySave,
  onSelectTodo,
  onSelectNote,
  onOpenNoteLink,
}: NoteEditorPaneProps) {
  const { editorRef, toolbarRef, contentInputRef, followCaret } = useNoteEditorLayout(draft.contentMarkdown, isPreview);
  const [isRelationPickerOpen, setIsRelationPickerOpen] = useState(false);
  const activeTodoIds = useMemo(() => draft.todoIds.filter((id) => todos.some((todo) => todo.id === id)), [draft.todoIds, todos]);
  const relationItems = useMemo(() => todos
    .filter((todo) => (!todo.isArchived && !todo.isCompleted) || draft.todoIds.includes(todo.id))
    .map((todo) => ({
      id: todo.id,
      title: todo.title || copy.untitledRelatedItem,
      description: todo.summary || undefined,
      keywords: [todo.detailMarkdown, ...todo.tags].join('\n'),
    })), [copy.untitledRelatedItem, draft.todoIds, todos]);
  const updatedAt = selectedNote
    ? new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(selectedNote.updatedAt))
    : '';

  return (
    <main ref={editorRef} className={`detail-panel note-editor ${selectedNote && !isPreview ? 'is-editing' : ''}`}>
      {error ? <div className="error-banner">{error}</div> : null}

      {!selectedNote ? (
        <div className="note-blank-state">
          <span className="note-blank-state__icon" aria-hidden="true">
            <IconBook2 size={28} stroke={1.7} />
          </span>
          <h2>{copy.blankTitle}</h2>
          <p>{copy.blankDescription}</p>
          <button type="button" className="primary-button note-blank-state__action" onClick={onCreateNote}>
            <IconPlus size={16} stroke={2.2} aria-hidden="true" />
            {copy.createNote}
          </button>
          <NoteTransferMenu copy={copy.transfer} saving={saving} canExport={false} onImport={onImportMarkdown} onExport={onExportDocument} />
        </div>
      ) : (
        <>
          <div ref={toolbarRef} className="note-toolbar">
            <span className="note-toolbar__updated">{copy.updatedAt(updatedAt)}</span>
            <div className="note-toolbar__actions">
              <SaveIndicator status={saveStatus} labels={copy.saveStatus} retryLabel={copy.retrySave} onRetry={onRetrySave} />
              <button type="button" className={`note-state-button ${draft.isPinned ? 'is-active is-pinned' : ''}`} onClick={() => onDraftChange((current) => ({ ...current, isPinned: !current.isPinned }))} aria-label={copy.pin} title={copy.pin} aria-pressed={draft.isPinned}>
                {draft.isPinned ? <IconPinFilled size={15} aria-hidden="true" /> : <IconPin size={15} stroke={2} aria-hidden="true" />}
              </button>
              <button type="button" className={`note-state-button ${draft.isFavorite ? 'is-active is-favorite' : ''}`} onClick={() => onDraftChange((current) => ({ ...current, isFavorite: !current.isFavorite }))} aria-label={copy.favorite} title={copy.favorite} aria-pressed={draft.isFavorite}>
                {draft.isFavorite ? <IconStarFilled size={15} aria-hidden="true" /> : <IconStar size={15} stroke={2} aria-hidden="true" />}
              </button>
              <button type="button" className={`note-state-button ${draft.isArchived ? 'is-active' : ''}`} onClick={() => onDraftChange((current) => ({ ...current, isArchived: !current.isArchived }))} aria-label={copy.archive} title={copy.archive} aria-pressed={draft.isArchived}><IconArchive size={15} stroke={2} aria-hidden="true" /></button>
              <div className="note-view-switch" aria-label={`${copy.editMode} / ${copy.previewMode}`}>
                <button
                  type="button"
                  className={`note-view-switch__button ${!isPreview ? 'is-active' : ''}`}
                  onClick={() => onPreviewChange(false)}
                  aria-pressed={!isPreview}
                >
                  <IconEdit size={14} stroke={2} aria-hidden="true" />
                  {copy.editMode}
                </button>
                <button
                  type="button"
                  className={`note-view-switch__button ${isPreview ? 'is-active' : ''}`}
                  onClick={() => onPreviewChange(true)}
                  aria-pressed={isPreview}
                >
                  <IconEye size={14} stroke={2} aria-hidden="true" />
                  {copy.previewMode}
                </button>
              </div>
              <NoteTransferMenu copy={copy.transfer} saving={saving} canExport onImport={onImportMarkdown} onExport={onExportDocument} />
              <button
                type="button"
                className="note-delete-button"
                onClick={onRequestDelete}
                disabled={saving}
                title={copy.deleteNote}
                aria-label={copy.deleteNote}
              >
                <IconTrash size={16} stroke={2} aria-hidden="true" />
              </button>
            </div>
          </div>

          <article className="note-paper">
            <input
              className="note-title-input"
              value={draft.title}
              onChange={(event) =>
                onDraftChange((current) => ({ ...current, title: event.target.value }))
              }
              placeholder={copy.titlePlaceholder}
              aria-label={copy.titlePlaceholder}
            />
            <div className="note-paper__rule" />
            {isPreview ? (
              draft.tags.length ? <div className="note-tag-row">{draft.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div> : null
            ) : (
              <div className="note-metadata-editor">
                <div className="todo-properties__bar">
                  <TagInput key={selectedNote.id} label={copy.tagsLabel} placeholder={copy.tagInputPlaceholder}
                    onAdd={(tags) => onDraftChange((current) => ({ ...current, tags: parseTags([...current.tags, ...tags].join(',')) }))} />
                  <button
                    type="button"
                    className="todo-property-button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => { event.currentTarget.focus(); setIsRelationPickerOpen(true); }}
                    aria-haspopup="dialog"
                    aria-expanded={isRelationPickerOpen}
                  >
                    <IconLink size={16} stroke={1.8} aria-hidden="true" />
                    <span>{copy.linkedTodosLabel}</span>
                    {activeTodoIds.length ? <span className="todo-property-button__count">{activeTodoIds.length}</span> : null}
                  </button>
                </div>
                <TagList tags={draft.tags} label={copy.tagsLabel} removeLabel={copy.removeTag}
                  onRemove={(tag) => onDraftChange((current) => ({ ...current, tags: current.tags.filter((value) => value !== tag) }))} />
              </div>
            )}
            <div className="note-paper__body">
              {isPreview ? (
                <div
                  className="preview-content note-preview"
                  dangerouslySetInnerHTML={{ __html: previewHTML }}
                  onClick={(event) => {
                    const anchor = (event.target as HTMLElement).closest('a');
                    const href = anchor?.getAttribute('href') ?? '';
                    if (!href.startsWith('#note:')) return;
                    event.preventDefault();
                    onOpenNoteLink(href.slice('#note:'.length));
                  }}
                />
              ) : (
                <textarea
                  ref={contentInputRef}
                  className="note-content-input"
                  value={draft.contentMarkdown}
                  onChange={(event) => {
                    onDraftChange((current) => ({
                      ...current,
                      contentMarkdown: event.target.value,
                    }));
                    followCaret();
                  }}
                  onKeyUp={(event) => {
                    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) followCaret();
                  }}
                  placeholder={copy.contentPlaceholder}
                  aria-label={copy.contentPlaceholder}
                  spellCheck
                />
              )}
            </div>
            {isPreview && (activeTodoIds.length || backlinks.length) ? (
              <div className="note-relations">
                {activeTodoIds.length ? (
                  <section><h3>{copy.linkedTodosLabel}</h3>{todos.filter((todo) => draft.todoIds.includes(todo.id)).map((todo) => <button key={todo.id} type="button" onClick={() => onSelectTodo(todo)}><IconLink size={14} stroke={2} aria-hidden="true" />{todo.title}</button>)}</section>
                ) : null}
                {backlinks.length ? (
                  <section><h3>{copy.backlinksLabel}</h3>{backlinks.map((note) => <button key={note.id} type="button" onClick={() => onSelectNote(note)}><IconLink size={14} stroke={2} aria-hidden="true" />{note.title}</button>)}</section>
                ) : null}
              </div>
            ) : null}
          </article>
          <span className="note-character-count">{copy.characterCount(draft.contentMarkdown.length)}</span>
          <RelationPickerDialog
            isOpen={isRelationPickerOpen}
            title={copy.linkedTodosLabel}
            searchPlaceholder={copy.relationSearchPlaceholder}
            emptyText={copy.relationEmpty}
            selectedCountText={copy.relationSelectedCount(activeTodoIds.length)}
            closeLabel={copy.close}
            doneLabel={copy.relationDone}
            items={relationItems}
            selectedIds={activeTodoIds}
            onToggle={(todoId) => onDraftChange((current) => ({
              ...current,
              todoIds: current.todoIds.includes(todoId)
                ? current.todoIds.filter((id) => id !== todoId)
                : [...current.todoIds, todoId],
            }))}
            onClose={() => setIsRelationPickerOpen(false)}
          />
        </>
      )}
    </main>
  );
}
