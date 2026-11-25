export type NavigationTraceEvent = {
  event: string;
  destination?: string | null;
  pathname?: string | null;
  status?: string;
  workspacePermissionStatus?: string;
  redirectReason?: string | null;
};

export function traceNavigation(event: NavigationTraceEvent): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.info('[Admiino navigation]', event);
  }
}
