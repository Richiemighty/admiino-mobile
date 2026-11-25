import type { TaskAccess } from './service';

export type TaskSwipeAction = 'status' | 'edit' | 'watch';

export function getTaskSwipeActions(access: TaskAccess | undefined): TaskSwipeAction[] {
  return [
    access?.canEdit ? 'status' : null,
    access?.canEdit && !access.readOnly ? 'edit' : null,
    access?.canView ? 'watch' : null,
  ].filter((action): action is TaskSwipeAction => action !== null);
}

export function getTaskSwipeRevealWidth(access: TaskAccess | undefined, actionWidth = 84): number {
  return getTaskSwipeActions(access).length * actionWidth;
}

export function getTaskSwipeOffset(open: boolean, revealWidth: number): number {
  return open ? -revealWidth : 0;
}

export function resolveTaskSwipeTarget({
  currentOffset,
  translationX,
  velocityX,
  revealWidth,
}: {
  currentOffset: number;
  translationX: number;
  velocityX: number;
  revealWidth: number;
}): 'open' | 'closed' {
  const nextOffset = Math.max(-revealWidth, Math.min(0, currentOffset + translationX));
  return velocityX < -300 || nextOffset < -(revealWidth * 0.45) ? 'open' : 'closed';
}
