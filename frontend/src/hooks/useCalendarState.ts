import { useMemo, useState } from 'react';
import type { CalendarView, Locale } from '../appTypes';
import { addDays, dateKey, monthCalendarCells, monthGridDates, parseDateKey, sameDay, startOfDay, startOfMonth, startOfWeek } from '../lib/date';
import type { Todo } from '../types';

export function useCalendarState(todos: Todo[], locale: Locale, draftDueDate: string) {
  const [isDueDatePickerOpen, setIsDueDatePickerOpen] = useState(false);
  const [dueDatePickerCursor, setDueDatePickerCursor] = useState(() => startOfMonth(new Date()));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [calendarCursor, setCalendarCursor] = useState(() => startOfDay(new Date()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => startOfDay(new Date()));

  const scheduledTodos = useMemo(
    () => todos
      .map((todo) => {
        const date = parseDateKey(todo.dueDate);
        return date ? { todo, date } : null;
      })
      .filter((item): item is { todo: Todo; date: Date } => item !== null),
    [todos],
  );

  const calendarDays = useMemo(() => {
    if (calendarView === 'month') {
      return monthGridDates(calendarCursor);
    }

    const start = startOfWeek(calendarCursor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [calendarCursor, calendarView]);

  const monthCells = useMemo(() => monthCalendarCells(calendarCursor), [calendarCursor]);

  const todosByDate = useMemo(() => {
    const grouped = new Map<string, Todo[]>();
    for (const entry of scheduledTodos) {
      const key = dateKey(entry.date);
      const existing = grouped.get(key) ?? [];
      existing.push(entry.todo);
      grouped.set(key, existing);
    }
    return grouped;
  }, [scheduledTodos]);

  const dueDatePickerMonthCells = useMemo(() => monthCalendarCells(dueDatePickerCursor), [dueDatePickerCursor]);
  const selectedDueDate = useMemo(() => parseDateKey(draftDueDate), [draftDueDate]);
  const selectedDateTodos = useMemo(
    () => todosByDate.get(dateKey(selectedCalendarDate)) ?? [],
    [selectedCalendarDate, todosByDate],
  );

  const selectedDateTitle = useMemo(
    () => new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(selectedCalendarDate),
    [locale, selectedCalendarDate],
  );

  const weekdayLabels = useMemo(() => {
    const start = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, index) =>
      new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(addDays(start, index)),
    );
  }, [locale]);

  const dueDatePickerCells = useMemo(
    () =>
      dueDatePickerMonthCells.map((day, index) => {
        if (!day) {
          return {
            key: `due-blank-${index}`,
            isBlank: true,
          };
        }

        return {
          key: dateKey(day),
          value: dateKey(day),
          dayNumber: day.getDate(),
          isBlank: false,
          isSelected: selectedDueDate ? sameDay(day, selectedDueDate) : false,
          isToday: sameDay(day, new Date()),
        };
      }),
    [dueDatePickerMonthCells, selectedDueDate],
  );

  const calendarCells = useMemo(
    () =>
      (calendarView === 'month' ? monthCells : calendarDays).map((day, index) => {
        if (!day) {
          return {
            key: `blank-${index}`,
            isBlank: true,
          };
        }

        const key = dateKey(day);
        const items = todosByDate.get(key) ?? [];

        return {
          key,
          dayNumber: day.getDate(),
          isBlank: false,
          isToday: sameDay(day, new Date()),
          isSelected: sameDay(day, selectedCalendarDate),
          badgeCount: items.length,
          hasPending: items.some((todo) => !todo.isCompleted),
        };
      }),
    [calendarDays, calendarView, monthCells, selectedCalendarDate, todosByDate],
  );

  function openCalendarBoard() {
    const today = startOfDay(new Date());
    setCalendarCursor(today);
    setSelectedCalendarDate(today);
    setCalendarView('month');
    setIsCalendarOpen(true);
  }

  function shiftCalendar(offset: number) {
    setCalendarCursor((current) =>
      calendarView === 'month'
        ? new Date(current.getFullYear(), current.getMonth() + offset, 1)
        : addDays(current, offset * 7),
    );
  }

  function openDueDatePicker() {
    const seedDate = parseDateKey(draftDueDate) ?? startOfDay(new Date());
    setDueDatePickerCursor(startOfMonth(seedDate));
    setIsDueDatePickerOpen(true);
  }

  return {
    isDueDatePickerOpen,
    setIsDueDatePickerOpen,
    dueDatePickerCursor,
    setDueDatePickerCursor,
    isCalendarOpen,
    setIsCalendarOpen,
    calendarView,
    setCalendarView,
    calendarCursor,
    setCalendarCursor,
    selectedCalendarDate,
    setSelectedCalendarDate,
    selectedDateTodos,
    selectedDateTitle,
    weekdayLabels,
    dueDatePickerCells,
    calendarCells,
    openCalendarBoard,
    shiftCalendar,
    openDueDatePicker,
  };
}
