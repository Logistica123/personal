const CELEBRATION_DISMISSED_STORAGE_KEY = 'celebrations:dismissed';

let cachedDismissedCelebrations: number[] | null = null;

const getDismissedCelebrations = (): number[] => {
  if (cachedDismissedCelebrations) {
    return cachedDismissedCelebrations;
  }

  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CELEBRATION_DISMISSED_STORAGE_KEY);
    if (!raw) {
      cachedDismissedCelebrations = [];
      return cachedDismissedCelebrations;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cachedDismissedCelebrations = [];
      return cachedDismissedCelebrations;
    }
    cachedDismissedCelebrations = parsed
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value));
    return cachedDismissedCelebrations;
  } catch {
    cachedDismissedCelebrations = [];
    return cachedDismissedCelebrations;
  }
};

const persistDismissedCelebrations = (values: number[]) => {
  cachedDismissedCelebrations = values;
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(CELEBRATION_DISMISSED_STORAGE_KEY, JSON.stringify(values));
  } catch {
    // ignore storage errors
  }
};

export const markCelebrationAsDismissed = (id: number | null | undefined) => {
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    return;
  }
  const current = getDismissedCelebrations();
  if (current.includes(id)) {
    return;
  }
  persistDismissedCelebrations([...current, id]);
};

export const hasCelebrationBeenDismissed = (id: number): boolean => {
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    return false;
  }
  return getDismissedCelebrations().includes(id);
};

export const resetCelebrationDismissedCache = () => {
  cachedDismissedCelebrations = null;
};

