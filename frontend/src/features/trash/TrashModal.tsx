import { IconFolder, IconListCheck, IconNote, IconTrash, IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { CommandDialog } from '../_primitives/CommandDialog';
import type { TrashData } from '../../types';

type TrashKind = 'group' | 'todo' | 'note';

type TrashModalProps = {
  isOpen: boolean;
  trash: TrashData;
  saving: boolean;
  emptying: boolean;
  emptyError: string;
  copy: {
    title: string;
    description: string;
    empty: string;
    close: string;
    restore: string;
    purge: string;
    confirmPurge: string;
    emptyAll: string;
    emptyConfirmTitle: string;
    emptyConfirmDescription: (count: number) => string;
    emptying: string;
    itemCount: (count: number) => string;
    cancel: string;
    groups: string;
    todos: string;
    notes: string;
  };
  onClose: () => void;
  onRestore: (kind: TrashKind, id: string) => void;
  onPurge: (kind: TrashKind, id: string) => void;
  onEmpty: () => Promise<boolean>;
};

export function TrashModal({ isOpen, trash, saving, emptying, emptyError, copy, onClose, onRestore, onPurge, onEmpty }: TrashModalProps) {
  const [pendingPurge, setPendingPurge] = useState('');
  const [isEmptyConfirmOpen, setIsEmptyConfirmOpen] = useState(false);
  const emptyButtonRef = useRef<HTMLButtonElement>(null);
  const count = trash.groups.length + trash.todos.length + trash.notes.length;
  const busy = saving || emptying;

  useEffect(() => {
    if (!isOpen) { setIsEmptyConfirmOpen(false); setPendingPurge(''); }
  }, [isOpen]);

  function handleCancelEmpty() {
    setIsEmptyConfirmOpen(false);
    requestAnimationFrame(() => emptyButtonRef.current?.focus());
  }

  async function handleConfirmEmpty() {
    if (busy || !count) return;
    if (await onEmpty()) { setIsEmptyConfirmOpen(false); setPendingPurge(''); }
  }

  const sections = [
    { kind: 'group' as const, title: copy.groups, icon: IconFolder, items: trash.groups },
    { kind: 'todo' as const, title: copy.todos, icon: IconListCheck, items: trash.todos },
    { kind: 'note' as const, title: copy.notes, icon: IconNote, items: trash.notes },
  ];

  return (
    <CommandDialog open={isOpen} title={isEmptyConfirmOpen ? copy.emptyConfirmTitle : copy.title}
      onClose={() => { if (!emptying) onClose(); }} contentClassName="trash-modal" overlayClassName="modal-backdrop">
      <header className="trash-modal__header">
        <div><h2>{copy.title}</h2><p>{copy.description}</p></div>
        <button type="button" disabled={emptying} onClick={onClose} aria-label={copy.close} title={copy.close}><IconX size={18} stroke={2} aria-hidden="true" /></button>
      </header>
      <div className="trash-modal__content">
        {isEmptyConfirmOpen ? (
          <section className="trash-empty-confirm">
            <span className="trash-empty-confirm__icon" aria-hidden="true"><IconTrash size={24} stroke={1.7} /></span>
            <h3>{copy.emptyConfirmTitle}</h3>
            <p>{copy.emptyConfirmDescription(count)}</p>
            {emptyError ? <div className="trash-empty-confirm__error" role="alert">{emptyError}</div> : null}
            <div className="trash-empty-confirm__actions">
              <button type="button" autoFocus disabled={emptying} onClick={handleCancelEmpty}>{copy.cancel}</button>
              <button type="button" className="is-danger" disabled={busy || !count} onClick={() => void handleConfirmEmpty()}>
                {emptying ? copy.emptying : copy.emptyAll}
              </button>
            </div>
          </section>
        ) : (
          <>
            {!count ? <div className="trash-modal__empty" role="status"><IconTrash size={24} stroke={1.7} aria-hidden="true" /><p>{copy.empty}</p></div> : null}
            {sections.map(({ kind, title, icon: Icon, items }) => items.length ? (
              <section key={kind} className="trash-section">
                <h3>{title}<span>{items.length}</span></h3>
                {items.map((item) => {
                  const key = `${kind}:${item.id}`;
                  return (
                    <div key={item.id} className="trash-row">
                      <Icon size={16} stroke={2} aria-hidden="true" />
                      <strong>{'name' in item ? item.name : item.title}</strong>
                      {pendingPurge === key ? (
                        <div className="trash-row__confirm">
                          <span>{copy.confirmPurge}</span>
                          <button type="button" onClick={() => setPendingPurge('')}>{copy.cancel}</button>
                          <button type="button" className="is-danger" disabled={saving} onClick={() => { onPurge(kind, item.id); setPendingPurge(''); }}>{copy.purge}</button>
                        </div>
                      ) : (
                        <div className="trash-row__actions">
                          <button type="button" disabled={saving} onClick={() => onRestore(kind, item.id)}>{copy.restore}</button>
                          <button type="button" className="is-danger" disabled={saving} onClick={() => setPendingPurge(key)}>{copy.purge}</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            ) : null)}
          </>
        )}
      </div>
      {!isEmptyConfirmOpen ? <footer className="trash-modal__footer">
        <span>{copy.itemCount(count)}</span>
        <button ref={emptyButtonRef} type="button" disabled={busy || !count} onClick={() => setIsEmptyConfirmOpen(true)}>
          <IconTrash size={15} stroke={1.8} aria-hidden="true" />{copy.emptyAll}
        </button>
      </footer> : null}
    </CommandDialog>
  );
}
