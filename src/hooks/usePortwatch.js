import { useEffect, useRef, useState } from 'react';
import { fetchPortwatchSnapshot, findNewEvents } from '../lib/portwatch.js';

const POLL_MS = 10_000;

export function usePortwatch(onEvents) {
  const [snapshot, setSnapshot] = useState(null);
  const [connection, setConnection] = useState('connecting');
  const [error, setError] = useState('');
  const previous = useRef(null);
  const notify = useRef(onEvents);
  notify.current = onEvents;

  useEffect(() => {
    let stopped = false;
    let controller;

    const refresh = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const next = await fetchPortwatchSnapshot(controller.signal);
        if (stopped) return;
        if (next.state === 'unconfigured') {
          setConnection('unconfigured');
          setError(next.message || 'The Portwatch feed adapter is not configured yet.');
          return;
        }
        const detected = findNewEvents(previous.current, next);
        previous.current = next;
        setSnapshot(next);
        setConnection('live');
        setError('');
        if (detected.length) notify.current(detected);
      } catch (failure) {
        if (stopped || failure.name === 'AbortError') return;
        setConnection('offline');
        setError(failure.message || 'The feed could not be reached.');
      }
    };

    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, []);

  return { snapshot, connection, error };
}
