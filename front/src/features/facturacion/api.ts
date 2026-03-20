import { useCallback, useMemo } from 'react';
import type { FacturacionDeps } from './deps';

export const buildDownloadUrl = (
  deps: Pick<FacturacionDeps, 'resolveApiUrl' | 'withAuthToken'>,
  apiBaseUrl: string,
  path: string | null | undefined
): string | null => {
  if (!path) {
    return null;
  }
  const resolved = deps.resolveApiUrl(apiBaseUrl, path);
  return deps.withAuthToken(resolved);
};

export const useFacturacionApi = (
  deps: Pick<
    FacturacionDeps,
    'resolveApiBaseUrl' | 'useStoredAuthUser' | 'buildActorHeaders' | 'resolveApiUrl' | 'parseJsonSafe'
  >
) => {
  const { resolveApiBaseUrl, useStoredAuthUser, buildActorHeaders, resolveApiUrl, parseJsonSafe } = deps;

  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const authUser = useStoredAuthUser();
  const actorHeaders = useMemo(() => buildActorHeaders(authUser), [buildActorHeaders, authUser]);

  const requestJson = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const url = resolveApiUrl(apiBaseUrl, path) ?? `${apiBaseUrl}${path}`;
      const isFormData = options.body instanceof FormData;
      const headers: HeadersInit = {
        Accept: 'application/json',
        ...actorHeaders,
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers ?? {}),
      };

      const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers,
      });

      const payload = (await parseJsonSafe(response)) as any;
      if (!response.ok) {
        const message = payload?.message ?? `Error ${response.status}: ${response.statusText}`;
        const error = new Error(message);
        (error as any).payload = payload;
        throw error;
      }
      return payload;
    },
    [actorHeaders, apiBaseUrl, parseJsonSafe, resolveApiUrl]
  );

  const requestText = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const url = resolveApiUrl(apiBaseUrl, path) ?? `${apiBaseUrl}${path}`;
      const headers: HeadersInit = {
        Accept: 'application/xml,text/plain,*/*',
        ...actorHeaders,
        ...(options.headers ?? {}),
      };

      const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers,
      });

      const text = await response.text();
      if (!response.ok) {
        let message = `Error ${response.status}: ${response.statusText}`;
        try {
          const parsed = JSON.parse(text) as { message?: string };
          if (parsed?.message) {
            message = parsed.message;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      return text;
    },
    [actorHeaders, apiBaseUrl, resolveApiUrl]
  );

  return { apiBaseUrl, actorHeaders, requestJson, requestText };
};

