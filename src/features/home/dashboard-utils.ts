import type { PersonalTaskItem } from '../../api/types';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = new Set(['pending', 'in_progress', 'in_review', 'delayed']);

function dateForDeadline(value: string | null | undefined): Date | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ||
    (dateOnly &&
      (date.getFullYear() !== Number(dateOnly[1]) ||
        date.getMonth() !== Number(dateOnly[2]) - 1 ||
        date.getDate() !== Number(dateOnly[3])))
    ? null
    : date;
}

function localDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_IN_MILLISECONDS,
  );
}

function deadlineDayOffset(deadline: string | null | undefined, now: Date): number | null {
  const date = dateForDeadline(deadline);
  return date ? localDayNumber(date) - localDayNumber(now) : null;
}

function isOpenTask(task: PersonalTaskItem): boolean {
  return task.status !== null && OPEN_STATUSES.has(task.status);
}

function priorityRank(priority: string | null): number {
  switch (priority?.toLowerCase()) {
    case 'urgent':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

function byDeadlineThenPriority(now: Date) {
  return (left: PersonalTaskItem, right: PersonalTaskItem) => {
    const leftOffset = deadlineDayOffset(left.deadline, now);
    const rightOffset = deadlineDayOffset(right.deadline, now);
    const leftDue = leftOffset ?? Number.POSITIVE_INFINITY;
    const rightDue = rightOffset ?? Number.POSITIVE_INFINITY;
    return leftDue - rightDue || priorityRank(right.priority) - priorityRank(left.priority);
  };
}

export function getDueDateLabel(
  deadline: string | null | undefined,
  now = new Date(),
): string | null {
  const date = dateForDeadline(deadline);
  if (!date) return null;

  const offset = localDayNumber(date) - localDayNumber(now);
  if (offset < 0) return 'Overdue';
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function getNeedsAttentionTasks(
  tasks: PersonalTaskItem[],
  now = new Date(),
): PersonalTaskItem[] {
  return tasks
    .filter((task) => {
      if (!isOpenTask(task)) return false;
      const offset = deadlineDayOffset(task.deadline, now);
      return (
        task.status === 'delayed' ||
        priorityRank(task.priority) >= 3 ||
        (offset !== null && offset <= 7)
      );
    })
    .sort((left, right) => {
      const leftOffset = deadlineDayOffset(left.deadline, now);
      const rightOffset = deadlineDayOffset(right.deadline, now);
      const leftOverdue = leftOffset !== null && leftOffset < 0 ? 1 : 0;
      const rightOverdue = rightOffset !== null && rightOffset < 0 ? 1 : 0;
      return (
        rightOverdue - leftOverdue ||
        priorityRank(right.priority) - priorityRank(left.priority) ||
        byDeadlineThenPriority(now)(left, right)
      );
    })
    .slice(0, 3);
}

export function getDueSoonTasks(tasks: PersonalTaskItem[], now = new Date()): PersonalTaskItem[] {
  return tasks
    .filter((task) => {
      if (!isOpenTask(task)) return false;
      const offset = deadlineDayOffset(task.deadline, now);
      return offset !== null && offset >= 0 && offset <= 7;
    })
    .sort(byDeadlineThenPriority(now))
    .slice(0, 3);
}
