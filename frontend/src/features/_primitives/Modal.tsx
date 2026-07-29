import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  contentClassName: string;
  overlayClassName?: string;
  children: ReactNode;
};

export function Modal({
  open,
  onClose,
  contentClassName,
  overlayClassName = 'modal-backdrop',
  children,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClassName}>
          <Dialog.Content className={contentClassName}>{children}</Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}