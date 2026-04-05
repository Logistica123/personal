import { useCallback, useMemo } from 'react';

type ApiDeps = {
  resolveApiBaseUrl: () => string;
  buildActorHeaders: (user: unknown) => Record<string, string>;
  authUser: unknown;
};

type ErrorPayload = {
  error?: unknown;
  message?: unknown;
  errors?: unknown;
};

const extractApiErrorMessage = (payload: unknown, fallback: string): string => {
  const data = (payload ?? {}) as ErrorPayload;
  if (typeof data.error === 'string' && data.error.trim() !== '') return data.error;
  if (typeof data.message === 'string' && data.message.trim() !== '') return data.message;

  const errors = data.errors;
  if (errors && typeof errors === 'object') {
    const firstKey = Object.keys(errors as Record<string, unknown>)[0];
    const firstVal = firstKey ? (errors as any)[firstKey] : null;
    if (Array.isArray(firstVal) && typeof firstVal[0] === 'string') return firstVal[0];
    if (typeof firstVal === 'string') return firstVal;
  }
  return fallback;
};

export function useLiqApi(deps: ApiDeps) {
  const { resolveApiBaseUrl, buildActorHeaders, authUser } = deps;
  const base = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const headers = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...buildActorHeaders(authUser),
    }),
    [buildActorHeaders, authUser]
  );

  const get = useCallback(
    async (path: string) => {
      const r = await fetch(`${base}/api/liq${path}`, {
        credentials: 'include',
        headers: headers(),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(extractApiErrorMessage(json, `Error ${r.status}`));
      return json;
    },
    [base, headers]
  );

  const post = useCallback(
    async (path: string, body: unknown) => {
      const r = await fetch(`${base}/api/liq${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: headers(),
        body: JSON.stringify(body),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(extractApiErrorMessage(json, `Error ${r.status}`));
      return json;
    },
    [base, headers]
  );

  const postForm = useCallback(
    async (path: string, formData: FormData) => {
      const actorHeaders = buildActorHeaders(authUser);
      const r = await fetch(`${base}/api/liq${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', ...actorHeaders },
        body: formData,
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(extractApiErrorMessage(json, `Error ${r.status}`));
      return json;
    },
    [base, buildActorHeaders, authUser]
  );

  const patch = useCallback(
    async (path: string, body: unknown) => {
      const r = await fetch(`${base}/api/liq${path}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: headers(),
        body: JSON.stringify(body),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(extractApiErrorMessage(json, `Error ${r.status}`));
      return json;
    },
    [base, headers]
  );

  const put = useCallback(
    async (path: string, body?: unknown) => {
      const r = await fetch(`${base}/api/liq${path}`, {
        method: 'PUT',
        credentials: 'include',
        headers: headers(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(extractApiErrorMessage(json, `Error ${r.status}`));
      return json;
    },
    [base, headers]
  );

  const del = useCallback(
    async (path: string) => {
      const r = await fetch(`${base}/api/liq${path}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: headers(),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(extractApiErrorMessage(json, `Error ${r.status}`));
      return json;
    },
    [base, headers]
  );

  return useMemo(
    () => ({ get, post, patch, put, delete: del, postForm }),
    [get, post, patch, put, del, postForm]
  );
}
