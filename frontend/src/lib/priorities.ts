import type { TodoPriority } from '../types';

export const TODO_PRIORITIES: readonly TodoPriority[] = ['q1', 'q2', 'q3', 'q4'];

export const TODO_PRIORITY_RANK: Record<TodoPriority, number> = {
  q1: 0,
  q2: 1,
  q3: 2,
  q4: 3,
};
