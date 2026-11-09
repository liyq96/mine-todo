import { IconArrowRight, IconFileText, IconListCheck, IconSearch, IconX } from '@tabler/icons-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CommandDialog } from '../_primitives/CommandDialog';
import { searchWorkspace } from '../../lib/productivity';
import type { WorkspaceSearchResult } from '../../lib/productivity';
import type { Note, Todo } from '../../types';

type GlobalSearchCopy = {
  title: string;
  placeholder: string;
  noResultsTitle: string;
  noResultsDescription: string;
  todoType: string;
  noteType: string;
  untitledTodo: string;
  untitledNote: string;
  emptyTodoPreview: string;
  emptyNotePreview: string;
  clearSearch: string;
  resultCount: (count: number) => string;
  selectHint: string;
  openHint: string;
  closeHint: string;
};

type GlobalSearchDialogProps = {
  isOpen: boolean;
  todos: Todo[];
  notes: Note[];
  copy: GlobalSearchCopy;
  onClose: () => void;
  onOpenResult: (result: WorkspaceSearchResult) => void;
};

type HighlightedTextProps = {
  text: string;
  query: string;
};

function HighlightedText({ text, query }: HighlightedTextProps) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return <>{text}</>;

  const parts: Array<{ value: string; match: boolean }> = [];
  const lowerText = text.toLocaleLowerCase();
  let cursor = 0;
  while (cursor < text.length) {
    const index = lowerText.indexOf(needle, cursor);
    if (index < 0) {
      parts.push({ value: text.slice(cursor), match: false });
      break;
    }
    if (index > cursor) parts.push({ value: text.slice(cursor, index), match: false });
    parts.push({ value: text.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
  }

  return <>{parts.map((part, index) => part.match
    ? <mark key={`${part.value}-${index}`} className="global-search-highlight">{part.value}</mark>
    : <span key={`${part.value}-${index}`}>{part.value}</span>)}</>;
}

export function GlobalSearchDialog({
  isOpen,
  todos,
  notes,
  copy,
  onClose,
  onOpenResult,
}: GlobalSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const results = useMemo(() => searchWorkspace(todos, notes, query), [notes, query, todos]);
  const hasQuery = Boolean(query.trim());

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const nextIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));
    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
      return;
    }
    resultRefs.current[nextIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, results.length]);

  function openResult(result: WorkspaceSearchResult) {
    onClose();
    onOpenResult(result);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (!results.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(results.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      openResult(results[activeIndex] ?? results[0]);
    }
  }

  return (
    <CommandDialog
      open={isOpen}
      title={copy.title}
      contentClassName={`global-search-dialog ${hasQuery ? 'is-expanded' : ''}`}
      overlayClassName="global-search-backdrop"
      onClose={onClose}
    >
      <div className="global-search-field">
        <IconSearch size={21} stroke={1.9} aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder={copy.placeholder}
          aria-label={copy.title}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={hasQuery}
          aria-controls={results.length ? listboxId : undefined}
          aria-activedescendant={results.length ? `${listboxId}-${activeIndex}` : undefined}
        />
        {query ? (
          <button type="button" className="global-search-field__clear" onClick={() => setQuery('')} aria-label={copy.clearSearch} title={copy.clearSearch}>
            <IconX size={15} stroke={2.2} aria-hidden="true" />
          </button>
        ) : <kbd className="global-search-field__shortcut">Ctrl K</kbd>}
      </div>

      {hasQuery ? (
        <>
          <div className="global-search-body">
            {results.length ? (
              <>
                <div className="global-search-count" role="status" aria-live="polite">{copy.resultCount(results.length)}</div>
                <div id={listboxId} className="global-search-results" role="listbox" aria-label={copy.title}>
                  {results.map((result, index) => {
                    const title = result.title || (result.kind === 'todo' ? copy.untitledTodo : copy.untitledNote);
                    const excerpt = result.excerpt || (result.kind === 'todo' ? copy.emptyTodoPreview : copy.emptyNotePreview);
                    return (
                      <button
                        key={`${result.kind}-${result.item.id}`}
                        ref={(node) => { resultRefs.current[index] = node; }}
                        id={`${listboxId}-${index}`}
                        type="button"
                        role="option"
                        aria-selected={activeIndex === index}
                        className={`global-search-result ${activeIndex === index ? 'is-active' : ''}`}
                        onMouseMove={() => setActiveIndex(index)}
                        onFocus={() => setActiveIndex(index)}
                        onClick={() => openResult(result)}
                      >
                        <span className={`global-search-result__type is-${result.kind}`}>
                          {result.kind === 'todo' ? <IconListCheck size={17} stroke={1.9} aria-hidden="true" /> : <IconFileText size={17} stroke={1.9} aria-hidden="true" />}
                          <span>{result.kind === 'todo' ? copy.todoType : copy.noteType}</span>
                        </span>
                        <span className="global-search-result__content">
                          <strong><HighlightedText text={title} query={query} /></strong>
                          <span><HighlightedText text={excerpt} query={query} /></span>
                        </span>
                        <IconArrowRight className="global-search-result__arrow" size={16} stroke={2} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="global-search-empty" role="status">
                <span className="global-search-empty__icon" aria-hidden="true"><IconSearch size={23} stroke={1.8} /></span>
                <strong>{copy.noResultsTitle}</strong>
                <p>{copy.noResultsDescription}</p>
              </div>
            )}
          </div>

          <footer className="global-search-footer" aria-hidden="true">
            <span><kbd>↑</kbd><kbd>↓</kbd>{copy.selectHint}</span>
            <span><kbd>Enter</kbd>{copy.openHint}</span>
            <span><kbd>Esc</kbd>{copy.closeHint}</span>
          </footer>
        </>
      ) : null}
    </CommandDialog>
  );
}
