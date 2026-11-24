import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Globe, Home, LogOut, Maximize, Minimize, Scissors } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/LanguageContext';
import type { DisplaySnapshot } from '../types/salon';
import { subscribeToQueue } from '../utils/liveQueue';
import { getSocket } from '../utils/socket';

const control = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-600 px-3 py-2 text-sm font-semibold text-white motion-safe:transition-colors hover:border-[#D4A017] hover:bg-[#1F2937] active:bg-[#374151] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C754]';

function safeBackDestination(value: unknown) {
  if (typeof value !== 'string' || !value) return;
  try {
    const url = new URL(value, window.location.origin);
    const appRoute = /^\/(?:join|reception|admin|(?:status|barber)(?:\/[^/]+)?)?\/?$/i;
    if (url.origin === window.location.origin && appRoute.test(url.pathname) &&
        url.pathname.startsWith('/') && !url.pathname.startsWith('//')) {
      return url.pathname + url.search + url.hash;
    }
  } catch {
    // A malformed or external referrer is not a navigation target.
  }
}

export function DisplayPage() {
  const { t, language, toggleLanguage } = useTranslation();
  const [data, setData] = useState<DisplaySnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [failed, setFailed] = useState(false);
  const [highlight, setHighlight] = useState<string[]>([]);
  const [now, setNow] = useState(() => new Date());
  const navigate = useNavigate();
  const { state } = useLocation();
  const display = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenFailed, setFullscreenFailed] = useState(false);
  const fullscreenSupported = document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function';

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === display.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  async function toggleFullscreen() {
    setFullscreenFailed(false);
    try {
      if (document.fullscreenElement === display.current) await document.exitFullscreen();
      else await display.current?.requestFullscreen();
    } catch {
      setFullscreenFailed(true);
    }
  }

  async function leave(destination: string) {
    if (document.fullscreenElement === display.current) {
      try {
        await document.exitFullscreen();
      } catch {
        // Leaving also removes the fullscreen element.
      }
    }
    navigate(destination, { replace: true });
  }

  const backDestination = safeBackDestination(state?.displayFrom) ?? safeBackDestination(document.referrer) ?? '/';


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
        return Number(response.headers.get('X-Salon-Refresh-After-Ms'));
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
    <main ref={display} className="min-h-screen overflow-auto bg-[#111827] px-4 py-4 text-white sm:px-6 lg:px-10 lg:py-6 2xl:px-14">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-gray-600 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Scissors aria-hidden="true" className="h-8 w-8 shrink-0 text-[#D4A017] lg:h-10 lg:w-10" />
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-extrabold sm:text-3xl xl:text-4xl">{t('salonName')}</h1>
            <p className="text-sm text-[#F2C754] sm:text-base">{t('display.title')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-xl font-semibold tabular-nums">{now.toLocaleTimeString(language === 'gu' ? 'gu-IN' : 'en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })}</p>
          {data && <p className="text-sm text-gray-200 sm:text-base">{t(data.salonOpen ? 'display.open' : 'display.closed')}</p>}
        </div>
        <div role="group" aria-label={t('display.controls')} className="flex max-w-full flex-wrap items-center gap-2">
          <button type="button" className={control} onClick={() => void leave(backDestination)}>
            <ArrowLeft aria-hidden="true" size={17} />{t('display.back')}
          </button>
          <button type="button" className={control} onClick={() => void leave('/')}>
            <Home aria-hidden="true" size={17} />{t('nav.home')}
          </button>
          {fullscreenSupported && (
            <button type="button" className={control} onClick={() => void toggleFullscreen()}>
              {fullscreen ? <Minimize aria-hidden="true" size={17} /> : <Maximize aria-hidden="true" size={17} />}
              {t(fullscreen ? 'display.exitFullscreen' : 'display.fullscreen')}
            </button>
          )}
          <button type="button" className={control} onClick={toggleLanguage}>
            <Globe aria-hidden="true" size={17} />{t('languageLabel')}
          </button>
          <button type="button" className={`${control} border-[#D4A017]/70 text-[#F2C754]`} onClick={() => void leave('/')}>
            <LogOut aria-hidden="true" size={17} />{t('display.exitTv')}
          </button>
        </div>
      </header>
      {fullscreenFailed && <p role="alert" className="mt-3 text-sm text-[#F2C754]">{t('display.fullscreenFailed')}</p>}

      {(!connected || failed) && <p role="status" className="mt-4 text-xl text-[#F2C754]">{t(!connected ? 'display.reconnecting' : 'display.refreshFailed')}</p>}
      {!data && !failed && <p role="status" className="mt-4 text-xl">{t('barber.loading')}</p>}
      {data && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:gap-6 2xl:gap-8">
          <section className="space-y-4 min-w-0 rounded-3xl border border-[#D4A017]/60 bg-[#1F2937] p-4 sm:p-5 2xl:p-8">
            <h2 className="text-2xl font-bold text-[#F2C754] lg:text-4xl">{t('display.nowServing')}</h2>
            {data.barbers.length === 0 && <p className="text-2xl">{t('display.noBarbers')}</p>}
            {data.barbers.map((barber) => (
              <div key={barber.name} className={`flex min-h-24 items-center justify-between gap-3 rounded-2xl p-3 sm:p-4 lg:p-6 ${barber.status === 'called' && barber.token && highlight.includes(barber.token) ? 'bg-[#D4A017] text-[#111827] motion-safe:animate-pulse' : 'bg-[#111827]'}`}>
                <div className="min-w-0">
                  <p className="break-words text-2xl font-semibold lg:text-3xl">{barber.name}</p>
                  <p className="text-xl">{t(`barber.state_${barber.status}`)}</p>
                </div>
                <span className="shrink-0 text-3xl font-black tabular-nums sm:text-4xl lg:text-6xl">{barber.token ?? '—'}</span>
              </div>
            ))}
          </section>
          <section className="space-y-4 min-w-0 rounded-3xl border border-gray-600 bg-[#1F2937] p-4 sm:p-5 2xl:p-8">
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
