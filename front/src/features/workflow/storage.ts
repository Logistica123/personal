import type { WorkflowDeleteHistoryEntry } from './types';

export const WORKFLOW_DELETE_HISTORY_KEY = 'workflow:delete-history';

export const readWorkflowDeleteHistory = (): WorkflowDeleteHistoryEntry[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(WORKFLOW_DELETE_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WorkflowDeleteHistoryEntry[]) : [];
  } catch {
    return [];
  }
};

export const persistWorkflowDeleteHistory = (items: WorkflowDeleteHistoryEntry[]): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(WORKFLOW_DELETE_HISTORY_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
};

