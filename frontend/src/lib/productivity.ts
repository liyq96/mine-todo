import type { Note, NoteLink, Todo } from '../types';
import type { TodoSmartView } from '../appTypes';

export type WorkspaceSearchResult =
  | { kind: 'todo'; item: Todo; title: string; excerpt: string; score: number }
  | { kind: 'note'; item: Note; title: string; excerpt: string; score: number };

export function parseTags(value: string) {
  const seen = new Set<string>();
  return value
    .split(/[,，\s]+/)
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter((tag) => {
      const key = tag.toLocaleLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.localeCompare(right));
}

export function matchesTodoView(todo: Todo, view: TodoSmartView, now = new Date()) {
  if (view === 'archived') return todo.isArchived;
  if (todo.isArchived) return false;
  if (view === 'all') return true;
  if (view === 'completed') return todo.isCompleted;
  if (todo.isCompleted) return false;
  if (view === 'no-date') return !todo.dueDate;
  if (!todo.dueDate) return false;

  const today = localDateKey(now);
  const due = todo.dueDate.slice(0, 10);
  if (view === 'today') return due === today;
  if (view === 'overdue') return due < today;
  if (view === 'upcoming') {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    return due >= today && due <= localDateKey(end);
  }
  return true;
}

export function searchWorkspace(todos: Todo[], notes: Note[], query: string) {
  const needle = cleanSearchText(query).toLocaleLowerCase();
  if (!needle) return [];

  const results: WorkspaceSearchResult[] = [];
  for (const todo of todos) {
    const fields = [
      { value: todo.title, weight: 120 },
      { value: todo.tags.map((tag) => `#${tag}`).join(' '), weight: 100 },
      { value: todo.summary, weight: 90 },
      { value: todo.detailMarkdown, weight: 80 },
      { value: todo.subitems.map((item) => item.content).join(' · '), weight: 70 },
    ];
    const match = bestSearchMatch(fields, needle);
    if (!match) continue;
    results.push({
      kind: 'todo',
      item: todo,
      title: todo.title,
      excerpt: match.index === 0
        ? firstSearchContext([todo.summary, todo.detailMarkdown, todo.tags.map((tag) => `#${tag}`).join(' '), todo.subitems.map((item) => item.content).join(' · ')])
        : makeSearchExcerpt(match.value, needle),
      score: match.score,
    });
  }

  for (const note of notes) {
    const fields = [
      { value: note.title, weight: 120 },
      { value: note.tags.map((tag) => `#${tag}`).join(' '), weight: 100 },
      { value: note.contentMarkdown, weight: 80 },
    ];
    const match = bestSearchMatch(fields, needle);
    if (!match) continue;
    results.push({
      kind: 'note',
      item: note,
      title: note.title,
      excerpt: match.index === 0
        ? firstSearchContext([note.contentMarkdown, note.tags.map((tag) => `#${tag}`).join(' ')])
        : makeSearchExcerpt(match.value, needle),
      score: match.score,
    });
  }

  return results
    .sort((left, right) => right.score - left.score
      || new Date(right.item.updatedAt).getTime() - new Date(left.item.updatedAt).getTime())
    .slice(0, 50);
}

function resolveInternalNoteLink(label: string, notes: Note[], bindings: NoteLink[]) {
  const key = label.trim().toLocaleLowerCase();
  const bound = bindings.find((link) => link.label.toLocaleLowerCase() === key);
  if (bound) return notes.find((note) => note.id === bound.noteId);
  const matches = notes.filter((note) => note.title.trim().toLocaleLowerCase() === key);
  return matches.length === 1 ? matches[0] : undefined;
}

export function renderInternalNoteLinks(source: string, notes: Note[], bindings: NoteLink[] = []) {
  return source.replace(/\[\[([^\r\n]*?)\]\](?!\])/g, (full, rawTitle: string) => {
    const title = rawTitle.trim();
    const note = resolveInternalNoteLink(title, notes, bindings);
    if (!note) return full;
    const label = title.replace(/([\\\[\]])/g, '\\$1');
    return `[${label}](#note:${note.id})`;
  });
}

export function noteBacklinks(note: Note, notes: Note[]) {
  return notes.filter((candidate) => candidate.id !== note.id
    && Array.from(candidate.contentMarkdown.matchAll(/\[\[([^\r\n]*?)\]\](?!\])/g))
      .some((match) => resolveInternalNoteLink(match[1], notes, candidate.internalLinks ?? [])?.id === note.id));
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function bestSearchMatch(
  fields: Array<{ value: string; weight: number }>,
  needle: string,
): { value: string; index: number; score: number } | null {
  let best: { value: string; index: number; score: number } | null = null;
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    const value = cleanSearchText(field.value);
    const matchIndex = value.toLocaleLowerCase().indexOf(needle);
    if (matchIndex < 0) continue;
    const exactBonus = value.toLocaleLowerCase() === needle ? 40 : 0;
    const startsWithBonus = matchIndex === 0 ? 20 : 0;
    const score = field.weight + exactBonus + startsWithBonus - Math.min(matchIndex, 30);
    if (!best || score > best.score) best = { value, index, score };
  }
  return best;
}

function firstSearchContext(values: string[]) {
  const value = values.map(cleanSearchText).find(Boolean) ?? '';
  return value.length > 116 ? `${value.slice(0, 113).trimEnd()}…` : value;
}

function makeSearchExcerpt(value: string, needle: string) {
  const cleanValue = cleanSearchText(value);
  const matchIndex = cleanValue.toLocaleLowerCase().indexOf(needle);
  if (matchIndex < 0 || cleanValue.length <= 116) return cleanValue;
  const start = Math.max(0, matchIndex - 42);
  const end = Math.min(cleanValue.length, matchIndex + needle.length + 68);
  return `${start ? '…' : ''}${cleanValue.slice(start, end).trim()}${end < cleanValue.length ? '…' : ''}`;
}

function cleanSearchText(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/[#>*_`~|\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
