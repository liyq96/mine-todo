import { useEffect, useRef } from 'react';
import { backend } from '../lib/wails';
import { readError } from '../lib/todos';

type CloseGuardOptions = {
  prepare: () => Promise<boolean>;
  finish: () => void;
  onError: (message: string) => void;
  errorText: string;
};

export function useCloseGuard(options: CloseGuardOptions) {
  const latest = useRef(options);
  latest.current = options;
  const pending = useRef(false);
  useEffect(() => backend.onCloseRequested(() => {
    if (pending.current) return;
    pending.current = true;
    void (async () => {
      try {
        if (await latest.current.prepare()) await backend.confirmClose();
      } catch (error) {
        latest.current.onError(readError(error, latest.current.errorText));
      } finally {
        pending.current = false;
        latest.current.finish();
      }
    })();
  }), []);
}
