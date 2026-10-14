import { IconBook2, IconEdit, IconEye, IconPlus, IconTrash } from '@tabler/icons-react';
import type { SaveStatus } from '../../appTypes';
import type { Note, NoteDraft } from '../../types';

type NoteEditorCopy = {
  blankTitle: string;
  blankDescription: string;
  createNote: string;
  titlePlaceholder: string;
  contentPlaceholder: string;
  editMode: string;
  previewMode: string;
  deleteNote: string;
  characterCount: (count: number) => string;
  updatedAt: (value: string) => string;
  saveStatus: Record<SaveStatus, string>;
};

type NoteEditorPaneProps = {
  error: string;
  selectedNote: Note | null;
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
};

export function NoteEditorPane({
  error,
  selectedNote,
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
}: NoteEditorPaneProps) {
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
    <main className="detail-panel note-editor">
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
        </div>
      ) : (
        <>
          <div className="note-toolbar">
            <span className="note-toolbar__updated">{copy.updatedAt(updatedAt)}</span>
            <div className="note-toolbar__actions">
              <span className={`save-hint is-${saveStatus}`}>{copy.saveStatus[saveStatus]}</span>
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
              <div
                className="preview-content note-preview"
                dangerouslySetInnerHTML={{ __html: previewHTML }}
              />
            ) : (
              <textarea
                className="note-content-input"
                value={draft.contentMarkdown}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    contentMarkdown: event.target.value,
                  }))
                }
                placeholder={copy.contentPlaceholder}
                aria-label={copy.contentPlaceholder}
                spellCheck
              />
            )}
            <footer className="note-paper__footer">
              <span>Markdown</span>
              <span>{copy.characterCount(draft.contentMarkdown.length)}</span>
            </footer>
          </article>
        </>
      )}
    </main>
  );
}
