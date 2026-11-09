import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

type CommandDialogProps = {
  open: boolean;
  title: string;
  contentClassName: string;
  overlayClassName: string;
  children: ReactNode;
  onClose: () => void;
};

export function CommandDialog({
  open,
  title,
  contentClassName,
  overlayClassName,
  children,
  onClose,
}: CommandDialogProps) {
  const returnFocus = useDialogFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
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
