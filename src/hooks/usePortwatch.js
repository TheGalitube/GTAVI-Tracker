import { useEffect, useRef, useState } from 'react';
import { fetchPortwatchSnapshot, findNewEvents, lifecycleEventKey } from '../lib/portwatch.js';

const POLL_MS = 10_000;

export function usePortwatch(onEvents) {
  const [snapshot, setSnapshot] = useState(null);
  const [connection, setConnection] = useState('connecting');
  const [error, setError] = useState('');
  const refreshRef = useRef(null);
  const [retrying, setRetrying] = useState(false);
  const previous = useRef(null);
  const seenEvents = useRef(new Set());
  const notify = useRef(onEvents);
  notify.current = onEvents;

  useEffect(() => {
    let stopped = false;
    let controller;

    const refresh = async (manual = false) => {
      if (controller) return;
      if (manual) setRetrying(true);
      controller = new AbortController();
      try {
        const next = await fetchPortwatchSnapshot(controller.signal);
        if (stopped) return;
        if (next.state === 'unconfigured') {
          setConnection('unconfigured');
          setError(next.message || 'The Portwatch feed adapter is not configured yet.');
          return;
        }
        const detected = findNewEvents(previous.current, next)
          .filter((event) => !seenEvents.current.has(lifecycleEventKey(event)));
        for (const event of next.events ?? []) {
          if (['opened', 'closed', 'merged'].includes(event.kind)) {
            seenEvents.current.add(lifecycleEventKey(event));
          }
        }
        previous.current = next;
        setSnapshot(next);
        setConnection('live');
        setError('');
        if (detected.length) notify.current(detected);
      } catch (failure) {
        if (stopped || failure.name === 'AbortError') return;
        setConnection('offline');
        setError(failure.message || 'The feed could not be reached.');
      } finally {
        controller = null;
        if (!stopped) setRetrying(false);
      }
    };

    refreshRef.current = refresh;
    const onOnline = () => refresh();
    window.addEventListener('online', onOnline);
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    return () => {
      stopped = true;
      refreshRef.current = null;
      window.removeEventListener('online', onOnline);
      controller?.abort();
      window.clearInterval(timer);
    };
  }, []);

  return { snapshot, connection, error, retrying, retry: () => refreshRef.current?.(true) };
}
