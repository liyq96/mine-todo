import { useCallback, useEffect, useRef, useState } from 'react';
import { readError } from '../lib/todos';
import type { SaveStatus } from '../appTypes';

type DraftAutosaveOptions<Draft, Result> = {
  scope: string | null;
  draft: Draft;
  savedDraft: Draft | null;
  delay: number;
  suspended?: boolean;
  save: (draft: Draft) => Promise<Result>;
  fromResult: (result: Result) => Draft;
  apply: (result: Result, preserveDraft: boolean) => void;
  onSettled?: () => Promise<void>;
  setSaving: (value: boolean) => void;
  setError: (value: string) => void;
  errorText: string;
};

// One writer per editor. Revisions invalidate responses even when a user
// reverts to the previously saved value while an older request is in flight.
export function useDraftAutosave<Draft, Result>(options: DraftAutosaveOptions<Draft, Result>) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const latest = useRef(options);
  const draftSignature = JSON.stringify(options.draft);
  const savedSignature = JSON.stringify(options.savedDraft);
  const identity = useRef({ scope: options.scope, draftSignature, savedSignature, revision: 0 });
  const persisted = useRef(savedSignature);
  const running = useRef<Promise<boolean> | null>(null);
  const timer = useRef<number | null>(null);
  const markEdited = useCallback(() => { identity.current.revision += 1; }, []);

  if (identity.current.scope !== options.scope) {
    identity.current = { scope: options.scope, draftSignature, savedSignature, revision: identity.current.revision + 1 };
    persisted.current = savedSignature;
    running.current = null;
  } else {
    if (identity.current.draftSignature !== draftSignature) identity.current.revision += 1;
    if (identity.current.savedSignature !== savedSignature) persisted.current = savedSignature;
    identity.current.draftSignature = draftSignature;
    identity.current.savedSignature = savedSignature;
  }
  latest.current = options;

  const flush = useCallback((): Promise<boolean> => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
    if (running.current) return running.current;
    const scope = latest.current.scope;
    if (!scope) return Promise.resolve(true);

    const task = Promise.resolve().then(async () => {
      const start = latest.current;
      start.setSaving(true);
      try {
        while (latest.current.scope === scope) {
          const current = latest.current;
          const signature = JSON.stringify(current.draft);
          const revision = identity.current.revision;
          if (signature !== persisted.current) {
            setSaveStatus('saving');
            const result = await current.save(current.draft);
            if (latest.current.scope !== scope) return false;
            persisted.current = JSON.stringify(current.fromResult(result));
            const preserveDraft = identity.current.revision !== revision;
            latest.current.apply(result, preserveDraft);
            // A changed draft, including a revert, is written after the old write.
            if (preserveDraft) continue;
          }
          if (latest.current.onSettled) await latest.current.onSettled?.();
          if (latest.current.scope !== scope) return false;
          if (identity.current.revision !== revision && JSON.stringify(latest.current.draft) !== persisted.current) continue;
          setSaveStatus('saved');
          latest.current.setError('');
          return true;
        }
        return false;
      } catch (error) {
        if (latest.current.scope !== scope) return false;
        setSaveStatus('failed');
        latest.current.setError(readError(error, latest.current.errorText));
        return false;
      } finally {
        if (running.current === task) running.current = null;
        start.setSaving(false);
      }
    });
    running.current = task;
    return task;
  }, []);

  useEffect(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (!options.scope) { setSaveStatus('saved'); return; }
    if (running.current) return;
    if (draftSignature === persisted.current) { setSaveStatus('saved'); return; }
    setSaveStatus('typing');
    if (options.suspended) return;
    timer.current = window.setTimeout(() => { void flush(); }, options.delay);
    return () => { if (timer.current !== null) window.clearTimeout(timer.current); };
  }, [options.scope, draftSignature, savedSignature, options.suspended, options.delay, flush]);

  return { saveStatus, flush, markEdited };
}
