import { describe, expect, it } from '@jest/globals';

import type { PersonalTaskItem } from '../../api/types';
import { getDueDateLabel, getDueSoonTasks, getNeedsAttentionTasks } from './dashboard-utils';

const task = (id: string, values: Partial<PersonalTaskItem> = {}): PersonalTaskItem => ({
  id,
  title: id,
  status: 'pending',
  priority: 'medium',
  ...values,
});

describe('P11 personal dashboard task helpers', () => {
  const now = new Date(2026, 6, 13, 12);

  it('labels date-only deadlines using the local calendar day', () => {
    expect(getDueDateLabel('2026-07-12', now)).toBe('Overdue');
    expect(getDueDateLabel('2026-07-13', now)).toBe('Today');
    expect(getDueDateLabel('2026-07-14', now)).toBe('Tomorrow');
    expect(getDueDateLabel('2026-07-13T00:00:00.000Z', now)).toBe('Today');
    expect(getDueDateLabel('not-a-date', now)).toBeNull();
  });

  it('selects only open, assigned tasks for attention and due-soon sections', () => {
    const tasks = [
      task('overdue', { deadline: '2026-07-12', priority: 'low' }),
      task('urgent', { priority: 'urgent' }),
      task('tomorrow', { deadline: '2026-07-14' }),
      task('later', { deadline: '2026-07-25' }),
      task('completed', { deadline: '2026-07-13', status: 'completed' }),
      task('cancelled', { deadline: '2026-07-13', status: 'cancelled' }),
    ];

    expect(getNeedsAttentionTasks(tasks, now).map(({ id }) => id)).toEqual([
      'overdue',
      'urgent',
      'tomorrow',
    ]);
    expect(getDueSoonTasks(tasks, now).map(({ id }) => id)).toEqual(['tomorrow']);
  });
});
