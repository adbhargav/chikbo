import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';

/**
 * Follows admin redirects on the client.
 *
 * The storefront is a static SPA, so a request for a renamed product or
 * category URL never reaches a server that could answer with a 301. When a
 * page cannot find what the URL asks for, it enables this hook, which asks the
 * API whether a redirect covers the path and, if so, replaces the URL.
 *
 * Returns true while the lookup is in flight (render a placeholder, not the
 * "not found" state) and false once it is known there is nowhere to go.
 */
export function useRedirectIfMoved(enabled: boolean): boolean {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [checkedPath, setCheckedPath] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || checkedPath === pathname) return;
    let cancelled = false;
    api<{ destination: string | null }>('/seo/redirect', { query: { path: pathname } })
      .then((res) => {
        if (cancelled) return;
        if (res.destination && res.destination !== pathname) {
          navigate(`${res.destination}${search}`, { replace: true });
          return;
        }
        setCheckedPath(pathname);
      })
      .catch(() => {
        if (!cancelled) setCheckedPath(pathname);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, pathname, search, checkedPath, navigate]);

  return enabled && checkedPath !== pathname;
}
