import { useCallback, useRef, useState } from 'react';

export function useBusyState() {
  const [count, setCount] = useState(0);
  const pending = useRef(0);
  const idleListeners = useRef<Array<{ maximum: number; resolve: () => void }>>([]);
  const setSaving = useCallback((busy: boolean) => {
    pending.current = Math.max(0, pending.current + (busy ? 1 : -1));
    setCount(pending.current);
    idleListeners.current = idleListeners.current.filter((listener) => {
      if (pending.current > listener.maximum) return true;
      listener.resolve();
      return false;
    });
  }, []);
  const waitForIdle = useCallback((maximum = 0) => pending.current > maximum
    ? new Promise<void>((resolve) => idleListeners.current.push({ maximum, resolve })) : Promise.resolve(), []);
  return { saving: count > 0, setSaving, waitForIdle };
}
