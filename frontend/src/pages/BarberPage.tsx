import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from '../i18n/LanguageContext';
import type { BarberDashboard } from '../types/salon';
import { getSocket } from '../utils/socket';
import { subscribeToQueue } from '../utils/liveQueue';

const button = 'min-h-11 rounded-xl border border-[#D4A017]/60 px-4 py-2 font-semibold text-[#F2C754] disabled:opacity-50';
const primary = 'min-h-11 rounded-xl bg-[#D4A017] px-4 py-2 font-bold text-[#111827] disabled:opacity-50';

export function BarberPage() {
  const { name = '' } = useParams();
  return <BarberSession key={name.toLowerCase()} name={name} />;
}

function BarberSession({ name }: { name: string }) {
  const { t, language } = useTranslation();
  const route = `/api/barber/${encodeURIComponent(name)}`;
  const [token, setToken] = useState('');
  const [credential, setCredential] = useState('');
  const [data, setData] = useState<BarberDashboard | null>(null);
  const [connected, setConnected] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(Date.now);
  const refresh = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!token) return;
    const live = subscribeToQueue(getSocket(), async (signal) => {
      try {
        const response = await fetch(`${route}/dashboard`, {
          signal,
          headers: { Authorization: `Bearer ${token}` },
        });
        if (signal.aborted) return;
        if (response.status === 401) {
          setToken('');
          setData(null);
          setActionError('sessionExpired');
          return;
        }
        if (!response.ok) throw new Error('Dashboard unavailable');
        const dashboard = await response.json() as BarberDashboard;
        if (signal.aborted) return;
        setData(dashboard);
        setNow(Date.now());
        setLoadError('');
      } catch (error) {
        if (!signal.aborted) setLoadError('loadFailed');
        throw error;
      }
    }, setConnected);
    refresh.current = live.refresh;
    return () => {
      refresh.current = null;
      live.stop();
    };
  }, [route, token]);

  const startedAt = data?.assignment?.startedAt;
  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  async function submit(path: string, method: 'POST' | 'PATCH', body?: object) {
    setPending(true);
    setActionError('');
    try {
      const response = await fetch(`${route}${path}`, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setActionError(typeof result.error === 'string' ? result.error : 'actionFailed');
        if (response.status === 401 && token) {
          setToken('');
          setData(null);
        } else if (token) {
          refresh.current?.();
        }
        return;
      }
      if (path === '/login') {
        setCredential('');
        setLoadError('');
        setToken((await response.json()).token);
      } else if (path === '/logout') {
        setToken('');
        setData(null);
      } else {
        refresh.current?.();
      }
    } catch {
      setActionError('actionFailed');
    } finally {
      setPending(false);
    }
  }

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit('/login', 'POST', { credential });
  }

  const assignment = data?.assignment;
  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000)) : 0;
  const elapsed = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
  const errorKey = actionError || (token ? loadError : '');
  const error = t(`barber.${errorKey}`);

  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-2xl border border-[#374151] bg-[#1F2937] p-4 text-white sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data?.name ?? name}</h1>
          {data && <p className="text-[#F2C754]">{t(`barber.state_${data.status}`)}</p>}
        </div>
        {token && <button className={button} disabled={pending} onClick={() => void submit('/logout', 'POST')}>{t('barber.logout')}</button>}
      </header>
      {errorKey && <p role="alert" className="text-red-300">{error.startsWith('barber.') ? t('barber.actionFailed') : error}</p>}
      {!token ? (
        <form className="space-y-3" onSubmit={login}>
          <label className="block font-medium" htmlFor="barber-credential">{t('barber.credential')}</label>
          <input id="barber-credential" className="min-h-11 w-full rounded-xl border border-gray-500 bg-[#111827] px-3" type="password" required maxLength={128} value={credential} onChange={(event) => setCredential(event.target.value)} />
          <button className={primary} disabled={pending}>{t('barber.login')}</button>
        </form>
      ) : (
        <>
          {!connected && <p role="status" className="text-[#F2C754]">{t('display.reconnecting')}</p>}
          {!data && !loadError && <p role="status">{t('barber.loading')}</p>}
          {data && (
            <>
              <section className="space-y-3 rounded-xl bg-[#111827] p-4">
                <h2 className="font-bold text-[#F2C754]">{t('barber.assignedCustomer')}</h2>
                {assignment ? (
                  <>
                    <p className="text-3xl font-bold">{assignment.token}</p>
                    <p>{assignment.customerName} · {t(`barber.state_${assignment.status}`)}</p>
                    <ul className="list-inside list-disc text-gray-200">
                      {assignment.services.map((service) => <li key={service.nameEn}>{language === 'gu' ? service.nameGu : service.nameEn}</li>)}
                    </ul>
                    <p>{t('barber.duration')}: {assignment.durationMinutes} {t('display.minutes')}</p>
                    {startedAt && <p>{t('barber.elapsed')}: <span className="tabular-nums">{elapsed}</span></p>}
                    <button className={`${primary} w-full`} disabled={pending || Boolean(loadError)} onClick={() => void submit(`/assignments/${encodeURIComponent(assignment.id)}/${assignment.status === 'called' ? 'start' : 'done'}`, 'POST')}>
                      {t(assignment.status === 'called' ? 'barber.startService' : 'barber.doneService')}
                    </button>
                  </>
                ) : <p>{t('barber.noAssignment')}</p>}
              </section>
              <p>{t('barber.nextForYou')}: <strong>{data.nextToken ?? '—'}</strong></p>
              {data.canToggleAvailability && (
                <button className={`${button} w-full`} disabled={pending || Boolean(loadError)} onClick={() => void submit('/availability', 'PATCH', { status: data.status === 'break' ? 'available' : 'break' })}>
                  {t(data.status === 'break' ? 'barber.endBreak' : 'barber.startBreak')}
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
