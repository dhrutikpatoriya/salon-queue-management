import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Scissors } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import type { CatalogBarber } from '../types/salon';
import { subscribeToQueue } from '../utils/liveQueue';
import { getSocket } from '../utils/socket';

export function BarberPortal() {
  const { t } = useTranslation();
  const [barbers, setBarbers] = useState<CatalogBarber[] | null>(null);
  const [failed, setFailed] = useState(false);
  const refresh = useRef<() => void>(() => {});

  useEffect(() => {
    const live = subscribeToQueue(getSocket(), async (signal) => {
      try {
        const response = await fetch('/api/salon/barbers?scope=portal', { signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Roster unavailable');
        const result = await response.json() as { barbers: CatalogBarber[] };
        if (signal.aborted) return;
        setBarbers(result.barbers);
        setFailed(false);
      } catch {
        if (!signal.aborted) setFailed(true);
      }
    }, () => {});
    refresh.current = live.refresh;
    return () => live.stop();
  }, []);

  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-[#434951] bg-[#1F2937] px-4 py-6 text-white sm:px-8 sm:py-9">
      <header className="mb-7 space-y-3">
        <Scissors aria-hidden="true" className="h-10 w-10 rounded-xl bg-[#D4A017]/15 p-2 text-[#F2C754]" />
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('nav.barber')}</h1>
        <p className="text-sm text-gray-300 sm:text-base">{t('barber.selectProfile')}</p>
      </header>
      {failed && (
        <div className="space-y-3">
          <p role="alert" className="text-red-300">{t('barber.serverUnavailable')}</p>
          <button className="min-h-11 rounded-xl border border-[#D4A017]/60 px-4 text-[#F2C754]" onClick={() => refresh.current()}>{t('barber.retry')}</button>
        </div>
      )}
      {!barbers && !failed && <p role="status">{t('barber.loadingProfiles')}</p>}
      {barbers?.length === 0 && !failed && <p role="status">{t('barber.noProfiles')}</p>}
      {barbers && barbers.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {barbers.map(({ id, name, status }) => (
            <li key={id} className="min-w-0">
              <Link to={`/barber/${encodeURIComponent(id)}`}
                className="flex min-h-20 items-center gap-3 rounded-2xl border border-gray-600 bg-[#111827] p-3 transition hover:border-[#D4A017] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C754] sm:p-4">
                <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#D4A017]/15 text-xl font-bold text-[#F2C754]">{name.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-lg font-semibold">{name}</span>
                  <span className="block text-sm text-gray-300">{t(`barber.state_${status}`)}</span>
                </span>
                <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-[#F2C754]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
