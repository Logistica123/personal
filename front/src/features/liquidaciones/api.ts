import { useCallback, useMemo, useRef } from 'react';

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
  // Estos refs evitan re-crear callbacks en cada render si `authUser` o `buildActorHeaders`
  // cambian de identidad (por ejemplo, si vienen de localStorage y se re-hidratan).
  const baseRef = useRef<string | null>(null);
  if (baseRef.current === null) baseRef.current = resolveApiBaseUrl();

  const buildActorHeadersRef = useRef(buildActorHeaders);
  buildActorHeadersRef.current = buildActorHeaders;

  const authUserRef = useRef(authUser);
  authUserRef.current = authUser;

  const headers = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...buildActorHeadersRef.current(authUserRef.current),
    };
  }, []);

  const get = useCallback(
    async (path: string) => {
      const r = await fetch(`${baseRef.current}/api/liq${path}`, {
        credentials: 'include',
        headers: headers(),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(extractApiErrorMessage(json, `Error ${r.status}`));
      return json;
    },
    [headers]
  );

  const post = useCallback(
    async (path: string, body: unknown) => {
      const r = await fetch(`${baseRef.current}/api/liq${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: headers(),
        body: JSON.stringify(body),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err: Error & { status?: number; data?: unknown } = new Error(extractApiErrorMessage(json, `Error ${r.status}`));
        err.status = r.status;
        err.data = json;
        throw err;
      }
      return json;
    },
    [headers]
  );

  const postForm = useCallback(
    async (path: string, formData: FormData) => {
      const actorHeaders = buildActorHeadersRef.current(authUserRef.current);
      const r = await fetch(`${baseRef.current}/api/liq${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', ...actorHeaders },
        body: formData,
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(extractApiErrorMessage(json, `Error ${r.status}`));
      return json;
    },
    []
  );

  const patch = useCallback(
    async (path: string, body: unknown) => {
      const r = await fetch(`${baseRef.current}/api/liq${path}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: headers(),
        body: JSON.stringify(body),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(extractApiErrorMessage(json, `Error ${r.status}`));
      return json;
    },
    [headers]
  );

  const put = useCallback(
    async (path: string, body?: unknown) => {
      const r = await fetch(`${baseRef.current}/api/liq${path}`, {
        method: 'PUT',
        credentials: 'include',
        headers: headers(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(extractApiErrorMessage(json, `Error ${r.status}`));
      return json;
    },
    [headers]
  );

  const del = useCallback(
    async (path: string) => {
      const r = await fetch(`${baseRef.current}/api/liq${path}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: headers(),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(extractApiErrorMessage(json, `Error ${r.status}`));
      return json;
    },
    [headers]
  );

  // SPEC v4.3 · descarga blob (xlsx, pdf, etc.) directo a archivo del navegador
  const downloadFile = useCallback(
    async (path: string, filename: string) => {
      const actorHeaders = buildActorHeadersRef.current(authUserRef.current);
      const r = await fetch(`${baseRef.current}/api/liq${path}`, {
        credentials: 'include',
        headers: actorHeaders,
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        throw new Error(extractApiErrorMessage(json, `Error ${r.status}`));
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    []
  );

  return useMemo(
    () => ({ get, post, patch, put, delete: del, postForm, downloadFile }),
    [get, post, patch, put, del, postForm, downloadFile]
  );
}
