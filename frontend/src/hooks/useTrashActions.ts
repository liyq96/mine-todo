import { useRef, useState } from 'react';
import { readError } from '../lib/todos';
import { backend } from '../lib/wails';
import type { BootstrapResponse } from '../types';

type UseTrashActionsArgs = {
  unknownErrorText: string;
  onUpdated: (data: BootstrapResponse) => void;
  onEmptied: () => void;
  beforeUpdate: () => Promise<boolean>;
  setSaving: (value: boolean) => void;
};

export function useTrashActions({ unknownErrorText, onUpdated, onEmptied, beforeUpdate, setSaving }: UseTrashActionsArgs) {
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
  const [emptyTrashError, setEmptyTrashError] = useState('');
  const emptyingRef = useRef(false);

  async function handleEmptyTrash() {
    if (emptyingRef.current) return false;
    emptyingRef.current = true;
    setIsEmptyingTrash(true);
    setEmptyTrashError('');
    setSaving(true);
    try {
      if (!(await beforeUpdate())) { setEmptyTrashError(unknownErrorText); return false; }
      const data = await backend.purgeTrash();
      onUpdated(data);
      onEmptied();
      return true;
    } catch (err) {
      setEmptyTrashError(readError(err, unknownErrorText));
      return false;
    } finally {
      emptyingRef.current = false;
      setIsEmptyingTrash(false);
      setSaving(false);
    }
  }

  return { isEmptyingTrash, emptyTrashError, handleEmptyTrash, clearEmptyTrashError: () => setEmptyTrashError('') };
}
