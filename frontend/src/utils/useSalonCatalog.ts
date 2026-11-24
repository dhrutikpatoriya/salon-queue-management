import { useEffect, useRef, useState } from 'react';
import type { CatalogBarber, CatalogService, PublicSalonStatus } from '../types/salon';
import { subscribeToQueue } from './liveQueue';
import { getSocket } from './socket';

interface SalonCatalog {
  status: PublicSalonStatus;
  services: CatalogService[];
  barbers: CatalogBarber[];
}

export function useSalonCatalog() {
  const [catalog, setCatalog] = useState<SalonCatalog | null>(null);
  const [failed, setFailed] = useState(false);
  const refresh = useRef<() => void>(() => {});

  useEffect(() => {
    const live = subscribeToQueue(getSocket(), async (signal) => {
      try {
        const responses = await Promise.all(['status', 'services', 'barbers'].map((resource) =>
          fetch(`/api/salon/${resource}`, { signal, cache: 'no-store' })));
        if (responses.some((response) => !response.ok)) throw new Error('Catalog unavailable');
        const [status, services, barbers] = await Promise.all(responses.map((response) => response.json()));
        if (signal.aborted) return;
        setCatalog({ status, services: services.services, barbers: barbers.barbers });
        setFailed(false);
        return status.refreshAfterMs as number;
      } catch (error) {
        if (!signal.aborted) setFailed(true);
        throw error;
      }
    }, () => {});
    refresh.current = live.refresh;
    return () => live.stop();
  }, []);

  return { catalog, failed, retry: () => refresh.current() };
}
