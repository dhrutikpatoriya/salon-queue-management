import { useEffect, useState } from 'react';
import { Globe, Maximize, Scissors } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import type { DisplaySnapshot } from '../types/salon';
import { subscribeToQueue } from '../utils/liveQueue';
import { getSocket } from '../utils/socket';

export function DisplayPage() {
  const { t, language, toggleLanguage } = useTranslation();
  const [data, setData] = useState<DisplaySnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [failed, setFailed] = useState(false);
  const [highlight, setHighlight] = useState<string[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let previous: DisplaySnapshot | undefined;
    let highlightTimer: ReturnType<typeof setTimeout> | undefined;
    const live = subscribeToQueue(getSocket(), async (signal, allowHighlight) => {
      try {
        const response = await fetch('/api/display', { signal });
        if (!response.ok) throw new Error('Display unavailable');
        const snapshot = await response.json() as DisplaySnapshot;
        if (signal.aborted) return;
        if (allowHighlight && previous?.date === snapshot.date) {
          const fresh = snapshot.barbers.filter((barber) => barber.status === 'called' && barber.token &&
            !previous?.barbers.some((prior) => prior.name === barber.name && prior.token === barber.token && prior.status === 'called'));
          if (fresh.length) {
            setHighlight(fresh.map(({ token }) => token!));
            clearTimeout(highlightTimer);
            highlightTimer = setTimeout(() => setHighlight([]), 4000);
          }
        }
        previous = snapshot;
        setData(snapshot);
        setFailed(false);
      } catch (error) {
        if (!signal.aborted) setFailed(true);
        throw error;
      }
    }, (online) => {
      setConnected(online);
      if (!online) {
        clearTimeout(highlightTimer);
        setHighlight([]);
      }
    });
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(highlightTimer);
      clearInterval(clock);
      live.stop();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#111827] p-5 text-white md:p-10 2xl:p-14">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-gray-600 pb-6">
        <div className="flex items-center gap-4">
          <Scissors aria-hidden="true" className="h-10 w-10 text-[#D4A017]" />
          <div>
            <h1 className="text-3xl font-extrabold lg:text-5xl">{t('salonName')}</h1>
            <p className="text-xl text-[#F2C754]">{t('display.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-2xl font-semibold tabular-nums">{now.toLocaleTimeString(language === 'gu' ? 'gu-IN' : 'en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })}</p>
          {data && <p className="text-xl">{t(data.salonOpen ? 'display.open' : 'display.closed')}</p>}
          <button className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-500 px-3" onClick={toggleLanguage}><Globe aria-hidden="true" size={20} />{t('languageLabel')}</button>
          {typeof document.documentElement.requestFullscreen === 'function' && (
            <button className="min-h-11 rounded-xl border border-gray-500 px-3" aria-label={t('display.fullscreen')} title={t('display.fullscreen')} onClick={() => {
              void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
            }}><Maximize aria-hidden="true" size={20} /></button>
          )}
        </div>
      </header>

      {(!connected || failed) && <p role="status" className="mt-4 text-xl text-[#F2C754]">{t(!connected ? 'display.reconnecting' : 'display.refreshFailed')}</p>}
      {!data && !failed && <p role="status" className="mt-4 text-xl">{t('barber.loading')}</p>}
      {data && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2 2xl:gap-10">
          <section className="space-y-4 rounded-3xl border border-[#D4A017]/60 bg-[#1F2937] p-5 2xl:p-8">
            <h2 className="text-2xl font-bold text-[#F2C754] lg:text-4xl">{t('display.nowServing')}</h2>
            {data.barbers.length === 0 && <p className="text-2xl">{t('display.noBarbers')}</p>}
            {data.barbers.map((barber) => (
              <div key={barber.name} className={`flex min-h-24 items-center justify-between gap-4 rounded-2xl p-4 lg:p-6 ${barber.status === 'called' && barber.token && highlight.includes(barber.token) ? 'bg-[#D4A017] text-[#111827] motion-safe:animate-pulse' : 'bg-[#111827]'}`}>
                <div>
                  <p className="text-2xl font-semibold lg:text-3xl">{barber.name}</p>
                  <p className="text-xl">{t(`barber.state_${barber.status}`)}</p>
                </div>
                <span className="text-4xl font-black tabular-nums lg:text-6xl">{barber.token ?? '—'}</span>
              </div>
            ))}
          </section>
          <section className="space-y-4 rounded-3xl border border-gray-600 bg-[#1F2937] p-5 2xl:p-8">
            <h2 className="text-2xl font-bold text-[#F2C754] lg:text-4xl">{t('display.upNext')}</h2>
            {data.waiting.length === 0 && <p className="text-2xl">{t('display.empty')}</p>}
            <ol className="space-y-3">
              {data.waiting.map(({ token, approxWaitMinutes }) => (
                <li key={token} className="flex min-h-20 flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#111827] p-4">
                  <span className="text-3xl font-black tabular-nums lg:text-5xl">{token}</span>
                  <span className="text-lg text-[#F2C754] lg:text-2xl">{approxWaitMinutes === null ? t('status.waitUnavailable') : `~${approxWaitMinutes} ${t('display.minutes')}`}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </main>
  );
}
