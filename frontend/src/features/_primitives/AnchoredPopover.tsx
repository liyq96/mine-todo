import * as Popover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';

type AnchoredPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  contentClassName: string;
  ariaLabel: string;
  align?: 'start' | 'center' | 'end';
  children: ReactNode;
};

export function AnchoredPopover({
  open,
  onOpenChange,
  trigger,
  contentClassName,
  ariaLabel,
  align = 'end',
  children,
}: AnchoredPopoverProps) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild aria-haspopup="menu">{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={contentClassName}
          align={align}
          sideOffset={7}
          collisionPadding={10}
          role="menu"
          aria-label={ariaLabel}
          onKeyDown={(event) => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)'));
            if (!items.length) return;
            event.preventDefault();
            const current = items.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
              : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items[next].focus();
          }}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
