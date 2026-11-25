export type TaskPrefetchPriority = 'visible' | 'lookahead';

export interface TaskPrefetchJob {
  key: string;
  priority: TaskPrefetchPriority;
  run: () => Promise<void>;
}

type QueuedJob = TaskPrefetchJob & { sequence: number };

export class TaskPrefetchQueue {
  private readonly concurrency: number;
  private readonly pending = new Map<string, QueuedJob>();
  private readonly active = new Set<string>();
  private sequence = 0;
  private drainScheduled = false;

  constructor(concurrency = 3) {
    this.concurrency = Math.max(1, Math.floor(concurrency));
  }

  enqueue(job: TaskPrefetchJob): boolean {
    if (this.pending.has(job.key) || this.active.has(job.key)) return false;
    this.pending.set(job.key, { ...job, sequence: this.sequence++ });
    this.scheduleDrain();
    return true;
  }

  clear(): void {
    this.pending.clear();
  }

  get activeCount(): number {
    return this.active.size;
  }

  private scheduleDrain(): void {
    if (this.drainScheduled) return;
    this.drainScheduled = true;
    queueMicrotask(() => {
      this.drainScheduled = false;
      this.drain();
    });
  }

  private drain(): void {
    while (this.active.size < this.concurrency && this.pending.size > 0) {
      const next = [...this.pending.values()].sort((left, right) => {
        const priority =
          left.priority === right.priority ? 0 : left.priority === 'visible' ? -1 : 1;
        return priority || left.sequence - right.sequence;
      })[0];
      this.pending.delete(next.key);
      this.active.add(next.key);
      void next
        .run()
        .catch(() => undefined)
        .finally(() => {
          this.active.delete(next.key);
          this.drain();
        });
    }
  }
}
