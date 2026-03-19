import type { ReclamoTransportistaSummary } from './types';

const TRANSPORTISTA_CACHE_KEY_PREFIX = 'reclamo-transportistas-';

const getTransportistaCacheKey = (reclamoId: number) => `${TRANSPORTISTA_CACHE_KEY_PREFIX}${reclamoId}`;

export const loadTransportistasFromCache = (reclamoId: number): ReclamoTransportistaSummary[] | undefined => {
  try {
    const raw = sessionStorage.getItem(getTransportistaCacheKey(reclamoId));
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      sessionStorage.removeItem(getTransportistaCacheKey(reclamoId));
      return undefined;
    }

    return parsed as ReclamoTransportistaSummary[];
  } catch {
    return undefined;
  }
};

export const persistTransportistasToCache = (reclamoId: number, transportistas: ReclamoTransportistaSummary[]) => {
  const key = getTransportistaCacheKey(reclamoId);
  if (transportistas.length === 0) {
    sessionStorage.removeItem(key);
    return;
  }

  try {
    sessionStorage.setItem(key, JSON.stringify(transportistas));
  } catch {
    // ignore storage failures
  }
};

