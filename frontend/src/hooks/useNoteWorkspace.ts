import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { readError } from '../lib/todos';
import { backend } from '../lib/wails';
import { useDraftAutosave } from './useDraftAutosave';
import type { Note, NoteDraft } from '../types';

type UseNoteWorkspaceArgs = {
  databasePath: string;
  notes: Note[];
  setNotes: Dispatch<SetStateAction<Note[]>>;
  untitledNote: string;
  unknownErrorText: string;
  suspended?: boolean;
  setSaving: (value: boolean) => void;
  setError: (value: string) => void;
  onSaved?: () => Promise<void>;
};

const emptyNoteDraft = (): NoteDraft => ({
  title: '', contentMarkdown: '', tags: [], todoIds: [],
  isPinned: false, isFavorite: false, isArchived: false,
});

function fromNote(note: Note): NoteDraft {
  return {
    title: note.title, contentMarkdown: note.contentMarkdown, tags: note.tags,
    todoIds: note.todoIds, isPinned: note.isPinned,
    isFavorite: note.isFavorite, isArchived: note.isArchived,
  };
}

function sortNotes(notes: Note[]) {
  return [...notes].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

export function useNoteWorkspace({ databasePath, notes, setNotes, untitledNote, unknownErrorText, suspended, setSaving, setError, onSaved }: UseNoteWorkspaceArgs) {
  const [boundDatabase, setBoundDatabase] = useState(databasePath);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteDraft>(emptyNoteDraft);
  const [isNotePreview, setIsNotePreview] = useState(false);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const creatingRef = useRef(false);
  const deletingRef = useRef(false);
  const navigationRef = useRef(0);
  const draftEditedRef = useRef(false);
  const refreshNeeded = useRef(false);
  const latest = useRef({ notes, selectedNoteId, databasePath });
  latest.current = { notes, selectedNoteId, databasePath };

  const selectedNote = useMemo(() => boundDatabase === databasePath
    ? notes.find((note) => note.id === selectedNoteId) ?? null : null,
  [notes, selectedNoteId, databasePath, boundDatabase]);
  const scope = selectedNote && databasePath && boundDatabase === databasePath
    ? JSON.stringify([databasePath, selectedNote.id]) : null;
  const savedSignature = JSON.stringify(selectedNote ? fromNote(selectedNote) : null);
  const previousModel = useRef({ scope, signature: savedSignature });

  // A database switch starts a new session, even when note IDs match.
  // Autosave has no scope until this reset has committed.
  useLayoutEffect(() => {
    if (boundDatabase === databasePath && selectedNoteId && notes.some((note) => note.id === selectedNoteId)) return;
    const first = notes[0] ?? null;
    navigationRef.current += 1;
    draftEditedRef.current = false;
    setBoundDatabase(databasePath);
    setSelectedNoteId(first?.id ?? null);
    setNoteDraft(first ? fromNote(first) : emptyNoteDraft());
    setIsNotePreview(Boolean(first));
  }, [databasePath, boundDatabase, notes, selectedNoteId]);

  useLayoutEffect(() => {
    const previous = previousModel.current;
    if (!draftEditedRef.current && scope && previous.scope === scope && previous.signature !== savedSignature
      && JSON.stringify(noteDraft) === previous.signature && selectedNote) {
      setNoteDraft(fromNote(selectedNote));
    }
    previousModel.current = { scope, signature: savedSignature };
  }, [scope, savedSignature, selectedNote, noteDraft]);

  const { saveStatus: noteSaveStatus, flush: flushCurrentNote, markEdited } = useDraftAutosave({
    scope, draft: noteDraft, savedDraft: selectedNote ? fromNote(selectedNote) : null,
    delay: 650, suspended: suspended || isDeletingNote,
    save: (value) => backend.updateNote({ id: selectedNoteId!, databasePath, ...value, title: value.title.trim() || untitledNote }),
    fromResult: fromNote,
    apply: (updated, preserveDraft) => {
      const previous = latest.current.notes.find((note) => note.id === updated.id);
      if (previous?.title !== updated.title || JSON.stringify(previous?.todoIds) !== JSON.stringify(updated.todoIds)) refreshNeeded.current = true;
      setNotes((current) => sortNotes(current.map((note) => note.id === updated.id ? updated : note)));
      if (!preserveDraft && latest.current.selectedNoteId === updated.id) {
        draftEditedRef.current = false;
        setNoteDraft(fromNote(updated));
      }
    },
    onSettled: async () => {
      if (refreshNeeded.current && onSaved) {
        await onSaved();
        refreshNeeded.current = false;
      }
    },
    setSaving, setError, errorText: unknownErrorText,
  });

  useLayoutEffect(() => {
    if (noteSaveStatus === 'saved' && JSON.stringify(noteDraft) === savedSignature) draftEditedRef.current = false;
  }, [noteSaveStatus, noteDraft, savedSignature]);

  const changeNoteDraft: Dispatch<SetStateAction<NoteDraft>> = (updater) => {
    markEdited();
    draftEditedRef.current = true;
    setNoteDraft((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (JSON.stringify(next) !== JSON.stringify(current)) draftEditedRef.current = true;
      return next;
    });
  };

  async function selectNote(note: Note) {
    if (note.id === latest.current.selectedNoteId) return true;
    const navigation = ++navigationRef.current;
    if (!(await flushCurrentNote()) || navigation !== navigationRef.current) return false;
    const freshNote = latest.current.notes.find((item) => item.id === note.id);
    if (!freshNote) return false;
    draftEditedRef.current = false;
    setSelectedNoteId(freshNote.id);
    setNoteDraft(fromNote(freshNote));
    setIsNotePreview(true);
    setError('');
    return true;
  }

  async function createNote() {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setSaving(true);
    try {
      if (!(await flushCurrentNote())) return;
      const created = await backend.createNote({ ...emptyNoteDraft(), title: untitledNote });
      draftEditedRef.current = false;
      setNotes((current) => sortNotes([created, ...current]));
      setSelectedNoteId(created.id);
      setNoteDraft(fromNote(created));
      setIsNotePreview(false);
      setError('');
    } catch (error) {
      setError(readError(error, unknownErrorText));
    } finally {
      creatingRef.current = false;
      setSaving(false);
    }
  }

  async function deleteNote() {
    const id = latest.current.selectedNoteId;
    if (!id || deletingRef.current) return false;
    deletingRef.current = true;
    setIsDeletingNote(true);
    setSaving(true);
    try {
      if (!(await flushCurrentNote())) return false;
      await backend.deleteNote(id);
      const remaining = latest.current.notes.filter((note) => note.id !== id);
      const next = remaining[0] ?? null;
      draftEditedRef.current = false;
      setNotes(remaining);
      setSelectedNoteId(next?.id ?? null);
      setNoteDraft(next ? fromNote(next) : emptyNoteDraft());
      setIsNotePreview(Boolean(next));
      setError('');
      return true;
    } catch (error) {
      setError(readError(error, unknownErrorText));
      return false;
    } finally {
      deletingRef.current = false;
      setIsDeletingNote(false);
      setSaving(false);
    }
  }

  return { selectedNote, selectedNoteId, noteDraft, noteSaveStatus, isNotePreview,
    setNoteDraft: changeNoteDraft, setIsNotePreview, selectNote, createNote, deleteNote, flushCurrentNote };
}
