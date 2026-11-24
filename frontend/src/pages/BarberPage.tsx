import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Coffee, Scissors } from 'lucide-react';
import { BarberPortal } from './BarberPortal';
import { useTranslation } from '../i18n/LanguageContext';
import type { BarberDashboard } from '../types/salon';
import { getSocket } from '../utils/socket';
import { subscribeToQueue } from '../utils/liveQueue';

const button = 'min-h-11 rounded-xl border border-[#D4A017]/60 px-4 py-2 font-semibold text-[#F2C754] disabled:opacity-50';
const primary = 'min-h-11 rounded-xl bg-[#D4A017] px-4 py-2 font-bold text-[#111827] disabled:opacity-50';

export function BarberPage() {
  const { name = '' } = useParams();
  return name ? <BarberSession key={name} name={name} /> : <BarberPortal />;
}

function BarberSession({ name }: { name: string }) {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
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
  const currentToken = useRef('');
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const session = currentToken.current;
      currentToken.current = '';
      if (session) void revoke(session).catch(() => {});
    };
  }, [route]);

  function revoke(session: string) {
    return fetch(`${route}/logout`, {
      method: 'POST', headers: { Authorization: `Bearer ${session}` }, keepalive: true,
    });
  }

  function clearSession() {
    currentToken.current = '';
    setToken('');
    setData(null);
  }

  async function signOut(switchProfile: boolean) {
    if (!currentToken.current || pending) return;
    setPending(true);
    setActionError('');
    try {
      const response = await revoke(currentToken.current);
      if (!response.ok && response.status !== 401) throw new Error('Sign-out unavailable');
      clearSession();
      if (switchProfile) navigate('/barber', { replace: true });
    } catch {
      setActionError('signOutFailed');
    } finally {
      setPending(false);
    }
  }


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
          clearSession();
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
        if (path === '/login' && response.status >= 500 && result.error !== 'credentialUnavailable') {
          setActionError('serverUnavailable');
        } else {
          setActionError(typeof result.error === 'string' ? result.error : 'actionFailed');
        }
        if (response.status === 401 && token) {
          clearSession();
        } else if (token) {
          refresh.current?.();
        }
        return;
      }
      if (path === '/login') {
        const { token: session } = await response.json() as { token: string };
        if (!mounted.current) {
          void revoke(session).catch(() => {});
          return;
        }
        currentToken.current = session;
        setCredential('');
        setLoadError('');
        setToken(session);
      } else {
        refresh.current?.();
      }
    } catch {
      setActionError(path === '/login' ? 'serverUnavailable' : 'actionFailed');
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
    <section className="mx-auto max-w-xl space-y-5 rounded-3xl border border-[#374151] bg-[#1F2937] p-4 text-white sm:p-7">
      <header className="space-y-4 border-b border-gray-600 pb-4">
        {!token && <Link to="/barber" className={`${button} inline-flex items-center gap-2 px-3`}><ArrowLeft aria-hidden="true" size={16} />{t('barber.backToProfiles')}</Link>}
        <div className="flex min-w-0 items-center gap-3">
          <Scissors aria-hidden="true" className="h-12 w-12 shrink-0 rounded-xl bg-[#D4A017]/15 p-3 text-[#F2C754]" />
          <div className="min-w-0">
            {token && <p className="text-sm text-gray-300">{t('barber.welcome')}</p>}
            <h1 className="break-words text-3xl font-bold">{data?.name ?? name}</h1>
            {data && <p className="mt-1 text-sm font-medium text-[#F2C754]">{t(`barber.state_${data.status}`)}</p>}
          </div>
        </div>
        {token && (
          <div className="flex flex-wrap gap-2">
            <button className={button} disabled={pending} onClick={() => void signOut(false)}>{t('barber.logout')}</button>
            <button className={button} disabled={pending} onClick={() => void signOut(true)}>{t('barber.switchProfile')}</button>
          </div>
        )}
      </header>
      {errorKey && <p role="alert" className="text-red-300">{error.startsWith('barber.') ? t('barber.actionFailed') : error}</p>}
      {!token ? (
        <form className="space-y-3" onSubmit={login}>
          <label className="block font-medium" htmlFor="barber-credential">{t('barber.credential')}</label>
          <input id="barber-credential" className="min-h-11 w-full rounded-xl border border-gray-500 bg-[#111827] px-3" type="password" autoComplete="current-password" required maxLength={128} value={credential} onChange={(event) => setCredential(event.target.value)} />
          <button className={primary} disabled={pending}>{t('barber.login')}</button>
        </form>
      ) : (
        <>
          {!connected && <p role="status" className="text-[#F2C754]">{t('display.reconnecting')}</p>}
          {!data && !loadError && <p role="status">{t('barber.loading')}</p>}
          {loadError && <button className={button} onClick={() => refresh.current?.()}>{t('barber.retry')}</button>}
          {data && (
            <>
              <section className="space-y-4 rounded-2xl border border-[#D4A017]/30 bg-[#111827] p-4 sm:p-6">
                <h2 className="font-bold text-[#F2C754]">{t('barber.assignedCustomer')}</h2>
                {assignment ? (
                  <>
                    <p className="break-words text-5xl font-black tracking-tight text-[#F2C754]">{assignment.token}</p>
                    <p className="break-words text-lg font-semibold">{assignment.customerName}</p>
                    <p className="text-sm text-gray-300">{t(`barber.state_${assignment.status}`)}</p>
                    <ul className="list-inside list-disc break-words text-gray-200">
                      {assignment.services.map((service) => <li key={service.nameEn}>{language === 'gu' ? service.nameGu : service.nameEn}</li>)}
                    </ul>
                    <p>{t('barber.duration')}: {assignment.durationMinutes} {t('display.minutes')}</p>
                    {startedAt && <p>{t('barber.elapsed')}: <span className="tabular-nums">{elapsed}</span></p>}
                    <button className={`${primary} min-h-14 w-full`} disabled={pending || Boolean(loadError)} onClick={() => void submit(`/assignments/${encodeURIComponent(assignment.id)}/${assignment.status === 'called' ? 'start' : 'done'}`, 'POST')}>
                      {t(assignment.status === 'called' ? 'barber.startService' : 'barber.doneService')}
                    </button>
                  </>
                ) : <p>{t('barber.noAssignment')}</p>}
              </section>
              <p className="rounded-xl border border-gray-600 px-4 py-3">{t('barber.nextForYou')}: <strong className="text-[#F2C754]">{data.nextToken ?? '—'}</strong></p>
              {data.canToggleAvailability && (
                <button className={`${button} w-full`} disabled={pending || Boolean(loadError)} onClick={() => void submit('/availability', 'PATCH', { status: data.status === 'break' ? 'available' : 'break' })}>
                  <Coffee aria-hidden="true" className="mr-2 inline h-4 w-4" />{t(data.status === 'break' ? 'barber.endBreak' : 'barber.startBreak')}
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
