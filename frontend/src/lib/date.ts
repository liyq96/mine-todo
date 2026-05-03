import type { Locale } from '../appTypes';
import { messages } from '../appMessages';

export function startOfDay(value: Date) {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(value: Date, days: number) {
  const copy = new Date(value);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function startOfWeek(value: Date) {
  const copy = startOfDay(value);
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(copy, offset);
}

export function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

export function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export function dateKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const key = value.slice(0, 10);
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function monthGridDates(value: Date) {
  const firstDay = startOfMonth(value);
  const gridStart = startOfWeek(firstDay);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export function monthCalendarCells(value: Date) {
  const firstDay = startOfMonth(value);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const lastDay = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= lastDay; day += 1) {
    cells.push(new Date(value.getFullYear(), value.getMonth(), day));
  }

  return cells;
}

export function formatCreatedAt(
  value: string,
  locale: Locale,
  copy: (typeof messages)[Locale],
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return copy.createdAtUnknown;
  }

  const formatted = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  return copy.createdAt(formatted);
}

export function formatDueDate(value: string, locale: Locale) {
  const date = parseDateKey(value);
  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
