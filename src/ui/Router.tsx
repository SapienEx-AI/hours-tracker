import { useEffect, useState } from 'react';

export type Route =
  | 'log'
  | 'dashboard'
  | 'entries'
  | 'projects'
  | 'rates'
  | 'snapshots'
  | 'settings';

const DEFAULT: Route = 'log';
const VALID: readonly Route[] = [
  'log',
  'dashboard',
  'entries',
  'projects',
  'rates',
  'snapshots',
  'settings',
];

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, '');
  return (VALID as readonly string[]).includes(raw) ? (raw as Route) : DEFAULT;
}

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRouteState] = useState<Route>(() => parseHash());

  useEffect(() => {
    const onHash = () => setRouteState(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setRoute = (r: Route) => {
    window.location.hash = r;
  };
  return [route, setRoute];
}
