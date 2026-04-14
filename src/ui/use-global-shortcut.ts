import { useEffect } from 'react';
import type { Route } from '@/ui/Router';
import { useUiStore } from '@/store/ui-store';

export function useGlobalShortcut(onNavigate: (r: Route) => void): void {
  const bumpFocusLog = useUiStore((s) => s.bumpFocusLog);
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isMetaOrCtrlK =
        (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k';
      if (!isMetaOrCtrlK) return;
      e.preventDefault();
      onNavigate('log');
      bumpFocusLog();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNavigate, bumpFocusLog]);
}
