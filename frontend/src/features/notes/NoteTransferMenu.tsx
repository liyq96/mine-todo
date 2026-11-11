import { IconChevronDown, IconFileText, IconFileTypeDocx, IconFileTypePdf } from '@tabler/icons-react';
import { useState } from 'react';
import { AnchoredPopover } from '../_primitives/AnchoredPopover';

export type NoteTransferCopy = {
  title: string;
  importLabel: string;
  exportLabel: string;
  markdown: string;
  importMarkdown: string;
  exportMarkdown: string;
  word: string;
  pdf: string;
  exportWord: string;
  exportPdf: string;
};

type NoteTransferMenuProps = {
  copy: NoteTransferCopy;
  saving: boolean;
  canExport: boolean;
  onImport: () => void;
  onExport: (format: 'markdown' | 'docx' | 'pdf') => void;
};

export function NoteTransferMenu({ copy, saving, canExport, onImport, onExport }: NoteTransferMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <AnchoredPopover open={isOpen} onOpenChange={setIsOpen} contentClassName="note-transfer-menu" ariaLabel={copy.title}
      trigger={(
        <button type="button" className="note-transfer-button" disabled={saving}>
          {copy.title}
          <IconChevronDown size={12} stroke={2} aria-hidden="true" />
        </button>
      )}>
      <section className="note-transfer-menu__section" role="group" aria-label={copy.importLabel}>
        <p>{copy.importLabel}</p>
        <button type="button" role="menuitem" className="note-transfer-menu__option" disabled={saving}
          aria-label={copy.importMarkdown} onClick={() => { setIsOpen(false); onImport(); }}>
          <IconFileText className="note-transfer-menu__icon note-transfer-menu__icon--markdown" size={16} stroke={1.8} aria-hidden="true" />
          {copy.markdown}
        </button>
      </section>
      <section className="note-transfer-menu__section" role="group" aria-label={copy.exportLabel}>
        <p>{copy.exportLabel}</p>
        <button type="button" role="menuitem" className="note-transfer-menu__option" disabled={saving || !canExport}
          aria-label={copy.exportMarkdown} onClick={() => { setIsOpen(false); onExport('markdown'); }}>
          <IconFileText className="note-transfer-menu__icon note-transfer-menu__icon--markdown" size={16} stroke={1.8} aria-hidden="true" />
          {copy.markdown}
        </button>
        <button type="button" role="menuitem" className="note-transfer-menu__option" disabled={saving || !canExport}
          aria-label={copy.exportWord} onClick={() => { setIsOpen(false); onExport('docx'); }}>
          <IconFileTypeDocx className="note-transfer-menu__icon note-transfer-menu__icon--word" size={16} stroke={1.8} aria-hidden="true" />
          {copy.word}
        </button>
        <button type="button" role="menuitem" className="note-transfer-menu__option" disabled={saving || !canExport}
          aria-label={copy.exportPdf} onClick={() => { setIsOpen(false); onExport('pdf'); }}>
          <IconFileTypePdf className="note-transfer-menu__icon note-transfer-menu__icon--pdf" size={16} stroke={1.8} aria-hidden="true" />
          {copy.pdf}
        </button>
      </section>
    </AnchoredPopover>
  );
}
