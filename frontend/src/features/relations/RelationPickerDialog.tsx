import { IconCheck, IconLink, IconSearch, IconX } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { CommandDialog } from '../_primitives/CommandDialog';

export type RelationPickerItem = {
  id: string;
  title: string;
  description?: string;
  keywords?: string;
};

type RelationPickerDialogProps = {
  isOpen: boolean;
  title: string;
  searchPlaceholder: string;
  emptyText: string;
  selectedCountText: string;
  closeLabel: string;
  doneLabel: string;
  items: RelationPickerItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
};

export function RelationPickerDialog({
  isOpen,
  title,
  searchPlaceholder,
  emptyText,
  selectedCountText,
  closeLabel,
  doneLabel,
  items,
  selectedIds,
  onToggle,
  onClose,
}: RelationPickerDialogProps) {
  const [query, setQuery] = useState('');
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleItems = useMemo(() => {
    if (!normalizedQuery) return items;
    return items.filter((item) =>
      [item.title, item.description, item.keywords]
        .filter(Boolean)
        .join('\n')
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [items, normalizedQuery]);

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  return (
    <CommandDialog
      open={isOpen}
      title={title}
      contentClassName="relation-picker"
      overlayClassName="modal-backdrop relation-picker-backdrop"
      onClose={onClose}
    >
      <header className="relation-picker__header">
        <div className="relation-picker__heading">
          <span className="relation-picker__heading-icon" aria-hidden="true">
            <IconLink size={17} stroke={2} />
          </span>
          <div>
            <h2>{title}</h2>
            <p aria-live="polite">{selectedCountText}</p>
          </div>
        </div>
        <button
          type="button"
          className="relation-picker__close"
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
        >
          <IconX size={17} stroke={2} aria-hidden="true" />
        </button>
      </header>

      <label className="relation-picker__search">
        <span className="sr-only">{searchPlaceholder}</span>
        <IconSearch size={16} stroke={2} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          autoFocus
        />
      </label>

      <div className="relation-picker__list">
        {visibleItems.length ? visibleItems.map((item) => {
          const isSelected = selectedIdSet.has(item.id);
          return (
            <label key={item.id} className={`relation-picker__item ${isSelected ? 'is-selected' : ''}`}>
              <input
                className="sr-only"
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(item.id)}
              />
              <span className="relation-picker__indicator" aria-hidden="true">
                {isSelected ? <IconCheck size={14} stroke={2.5} /> : null}
              </span>
              <span className="relation-picker__item-copy">
                <strong>{item.title}</strong>
                {item.description ? <small>{item.description}</small> : null}
              </span>
            </label>
          );
        }) : (
          <div className="relation-picker__empty">
            <IconSearch size={20} stroke={1.7} aria-hidden="true" />
            <p>{emptyText}</p>
          </div>
        )}
      </div>

      <footer className="relation-picker__footer">
        <span>{selectedCountText}</span>
        <button type="button" onClick={onClose}>{doneLabel}</button>
      </footer>
    </CommandDialog>
  );
}
