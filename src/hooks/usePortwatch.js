import { useEffect, useRef, useState } from 'react';
import { fetchPortwatchSnapshot, findNewEvents, lifecycleEventKey } from '../lib/portwatch.js';
import { raceChanges } from '../lib/broadcast.js';

const CACHE_KEY = 'portrace:last-snapshot-v1';
function readCache() {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY));
    return saved?.state === 'connected' && ['teams', 'events', 'pullRequests', 'history'].every((key) => Array.isArray(saved[key])) ? saved : null;
  } catch { return null; }
}
const POLL_MS = 10_000;

export function usePortwatch(onEvents) {
  const [snapshot, setSnapshot] = useState(readCache);
  const [movement, setMovement] = useState({});
  const [raceNews, setRaceNews] = useState([]);
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
    let lastSave = 0;

    const refresh = async (manual = false) => {
      if (controller) return;
      if (manual) setRetrying(true);
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(new DOMException('The feed timed out.', 'TimeoutError')), 90_000);
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
        // Retain enough IDs for old feed entries to reappear without unbounded growth.
        while (seenEvents.current.size > 2048) seenEvents.current.delete(seenEvents.current.values().next().value);
        if (previous.current && !next.raceCached && previous.current.raceObservedAt !== next.raceObservedAt) {
          const race = raceChanges(previous.current, next);
          setMovement(race.movement);
          detected.unshift(...race.changes);
          if (race.changes.length) setRaceNews((news) => [...race.changes, ...news].slice(0, 10));
        }
        if (Date.now() - lastSave >= 60_000) {
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* Storage is optional. */ }
          lastSave = Date.now();
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
        window.clearTimeout(timeout);
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

  return { snapshot, movement, raceNews, connection, error, retrying, retry: () => refreshRef.current?.(true) };
}
