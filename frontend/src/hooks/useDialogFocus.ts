import { useRef } from 'react';

export function useDialogFocus(open: boolean) {
  const wasOpen = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  if (open && !wasOpen.current) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  wasOpen.current = open;
  return (event: Event) => {
    event.preventDefault();
    queueMicrotask(() => { if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }); });
  };
}
