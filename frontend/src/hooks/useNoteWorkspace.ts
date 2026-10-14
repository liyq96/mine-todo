import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SaveStatus } from '../appTypes';
import { readError } from '../lib/todos';
import { backend } from '../lib/wails';
import type { Note, NoteDraft } from '../types';

type UseNoteWorkspaceArgs = {
  notes: Note[];
  setNotes: Dispatch<SetStateAction<Note[]>>;
  untitledNote: string;
  unknownErrorText: string;
  setSaving: (value: boolean) => void;
  setError: (value: string) => void;
};

const emptyNoteDraft = (): NoteDraft => ({ title: '', contentMarkdown: '' });

function fromNote(note: Note): NoteDraft {
  return {
    title: note.title,
    contentMarkdown: note.contentMarkdown,
  };
}

function sortNotes(notes: Note[]) {
  return [...notes].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export function useNoteWorkspace({
  notes,
  setNotes,
  untitledNote,
  unknownErrorText,
  setSaving,
  setError,
}: UseNoteWorkspaceArgs) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteDraft>(emptyNoteDraft);
  const [noteSaveStatus, setNoteSaveStatus] = useState<SaveStatus>('saved');
  const [isNotePreview, setIsNotePreview] = useState(false);
  const autosaveTokenRef = useRef(0);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );

  const draftSignature = useMemo(() => JSON.stringify(noteDraft), [noteDraft]);
  const selectedSignature = useMemo(
    () => (selectedNote ? JSON.stringify(fromNote(selectedNote)) : ''),
    [selectedNote],
  );

  useEffect(() => {
    if (selectedNoteId && notes.some((note) => note.id === selectedNoteId)) {
      return;
    }
    const first = notes[0] ?? null;
    setSelectedNoteId(first?.id ?? null);
    setNoteDraft(first ? fromNote(first) : emptyNoteDraft());
    setNoteSaveStatus('saved');
  }, [notes, selectedNoteId]);

  useEffect(() => {
    if (!selectedNote || draftSignature === selectedSignature) {
      setNoteSaveStatus('saved');
      return;
    }

    setNoteSaveStatus('typing');
    const token = autosaveTokenRef.current + 1;
    autosaveTokenRef.current = token;
    const timer = window.setTimeout(() => {
      void persistNote(selectedNote.id, noteDraft, token);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [draftSignature, selectedNote, selectedSignature]);

  function syncNote(updated: Note) {
    setNotes((current) =>
      sortNotes(current.map((note) => (note.id === updated.id ? updated : note))),
    );
    if (selectedNoteId === updated.id) {
      setNoteDraft(fromNote(updated));
    }
  }

  async function persistNote(id: string, draft: NoteDraft, token?: number) {
    if (token !== undefined && token !== autosaveTokenRef.current) {
      return false;
    }

    try {
      setSaving(true);
      setNoteSaveStatus('saving');
      const updated = await backend.updateNote({
        id,
        title: draft.title.trim() || untitledNote,
        contentMarkdown: draft.contentMarkdown,
      });
      if (token !== undefined && token !== autosaveTokenRef.current) {
        return false;
      }
      syncNote(updated);
      setNoteSaveStatus('saved');
      setError('');
      return true;
    } catch (err) {
      setNoteSaveStatus('failed');
      setError(readError(err, unknownErrorText));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function flushCurrentNote() {
    autosaveTokenRef.current += 1;
    if (!selectedNote || draftSignature === selectedSignature) {
      return true;
    }
    return persistNote(selectedNote.id, noteDraft);
  }

  async function selectNote(note: Note) {
    if (note.id === selectedNoteId) {
      return;
    }
    if (!(await flushCurrentNote())) {
      return;
    }
    const freshNote = notes.find((item) => item.id === note.id) ?? note;
    setSelectedNoteId(freshNote.id);
    setNoteDraft(fromNote(freshNote));
    setIsNotePreview(false);
    setNoteSaveStatus('saved');
    setError('');
  }

  async function createNote() {
    if (!(await flushCurrentNote())) {
      return;
    }
    try {
      setSaving(true);
      const created = await backend.createNote({
        title: untitledNote,
        contentMarkdown: '',
      });
      setNotes((current) => sortNotes([created, ...current]));
      setSelectedNoteId(created.id);
      setNoteDraft(fromNote(created));
      setIsNotePreview(false);
      setNoteSaveStatus('saved');
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote() {
    if (!selectedNoteId) {
      return false;
    }
    try {
      setSaving(true);
      autosaveTokenRef.current += 1;
      await backend.deleteNote(selectedNoteId);
      const remaining = notes.filter((note) => note.id !== selectedNoteId);
      const next = remaining[0] ?? null;
      setNotes(remaining);
      setSelectedNoteId(next?.id ?? null);
      setNoteDraft(next ? fromNote(next) : emptyNoteDraft());
      setIsNotePreview(false);
      setNoteSaveStatus('saved');
      setError('');
      return true;
    } catch (err) {
      setError(readError(err, unknownErrorText));
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    selectedNote,
    selectedNoteId,
    noteDraft,
    noteSaveStatus,
    isNotePreview,
    setNoteDraft,
    setIsNotePreview,
    selectNote,
    createNote,
    deleteNote,
  };
}
