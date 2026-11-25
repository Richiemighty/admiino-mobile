import { describe, expect, it } from '@jest/globals';

import {
  getTaskSwipeActions,
  getTaskSwipeOffset,
  getTaskSwipeRevealWidth,
  resolveTaskSwipeTarget,
} from './taskSwipe';

const editableAccess = { canView: true, canEdit: true, readOnly: false };

describe('task swipe geometry', () => {
  it('keeps a closed card at zero revealed offset', () => {
    expect(getTaskSwipeOffset(false, getTaskSwipeRevealWidth(editableAccess))).toBe(0);
  });

  it('uses only permission-authorised tiles to calculate reveal width', () => {
    expect(getTaskSwipeActions({ canView: true, canEdit: false, readOnly: true })).toEqual([
      'watch',
    ]);
    expect(getTaskSwipeRevealWidth({ canView: true, canEdit: false, readOnly: true })).toBe(84);
    expect(getTaskSwipeRevealWidth(editableAccess)).toBe(252);
  });

  it('returns a partial drag below threshold to closed and a decisive drag to open', () => {
    expect(
      resolveTaskSwipeTarget({
        currentOffset: 0,
        translationX: -20,
        velocityX: 0,
        revealWidth: 252,
      }),
    ).toBe('closed');
    expect(
      resolveTaskSwipeTarget({
        currentOffset: 0,
        translationX: -140,
        velocityX: 0,
        revealWidth: 252,
      }),
    ).toBe('open');
  });

  it('closes on a reverse swipe and opens on a fast left swipe', () => {
    expect(
      resolveTaskSwipeTarget({
        currentOffset: -252,
        translationX: 160,
        velocityX: 0,
        revealWidth: 252,
      }),
    ).toBe('closed');
    expect(
      resolveTaskSwipeTarget({
        currentOffset: 0,
        translationX: -5,
        velocityX: -500,
        revealWidth: 252,
      }),
    ).toBe('open');
  });
});
