import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

type ModalProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  contentClassName: string;
  overlayClassName?: string;
  children: ReactNode;
};

export function Modal({
  title,
  open,
  onClose,
  contentClassName,
  overlayClassName = 'modal-backdrop',
  children,
}: ModalProps) {
  const returnFocus = useDialogFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClassName}>
          <Dialog.Content className={contentClassName} aria-describedby={undefined} onCloseAutoFocus={returnFocus}>
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
