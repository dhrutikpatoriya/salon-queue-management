import { StaffAccess } from '../components/StaffAccess';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import type { OwnerDashboard, QueueStatus, ServiceCategory } from '../types/salon';
import { subscribeToQueue } from '../utils/liveQueue';
import { getSocket } from '../utils/socket';

const panel = 'space-y-4 rounded-2xl border border-gray-600 bg-[#1F2937] p-4 sm:p-6';
const field = 'min-h-11 w-full min-w-0 rounded-xl border border-gray-500 bg-[#111827] px-3 py-2 text-white';
const primary = 'min-h-11 rounded-xl bg-[#D4A017] px-4 py-2 font-bold text-[#111827] disabled:opacity-50';
const secondary = 'min-h-11 rounded-xl border border-gray-500 px-4 py-2 text-white disabled:opacity-50';
const statuses: QueueStatus[] = ['waiting', 'called', 'in_chair', 'done', 'cancelled', 'no_show'];
const categories: ServiceCategory[] = ['hair', 'beard', 'spa', 'color'];
const categoryKey = { hair: 'categoryHair', beard: 'categoryBeard', spa: 'categorySpa', color: 'categoryColor' };

type Service = OwnerDashboard['services'][number];
type Hours = Pick<OwnerDashboard['settings'], 'openTime' | 'closeTime' | 'onlineJoiningEnabled'>;

export function AdminPage() {
  const { t, language } = useTranslation();
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [data, setData] = useState<OwnerDashboard | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [hoursDraft, setHoursDraft] = useState<Hours | null>(null);
  const [editingService, setEditingService] = useState<Service | 'new' | null>(null);
  const refresh = useRef<() => void>(() => {});

  function clearSession() {
    setToken('');
    setData(null);
    setHoursDraft(null);
    setEditingService(null);
  }

  useEffect(() => {
    if (!token) return;
    const live = subscribeToQueue(getSocket(), async (signal) => {
      try {
        const response = await fetch('/api/admin/dashboard', {
          signal, headers: { Authorization: `Bearer ${token}` },
        });
        if (signal.aborted) return;
        if (response.status === 401) {
          clearSession();
          setMessage('sessionExpired');
          return;
        }
        if (!response.ok) throw new Error('Owner dashboard unavailable');
        const dashboard = await response.json() as OwnerDashboard;
        if (signal.aborted) return;
        setData(dashboard);
        setLoadFailed(false);
        return dashboard.settings.refreshAfterMs;
      } catch (error) {
        if (!signal.aborted) setLoadFailed(true);
        throw error;
      }
    }, () => {});
    refresh.current = live.refresh;
    return () => live.stop();
  }, [token]);

  async function send(path: string, method: 'POST' | 'PATCH', body?: object) {
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin${path}`, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setMessage(typeof result.error === 'string' ? result.error : 'saveFailed');
        if (response.status === 401 && token) clearSession();
        return false;
      }
      if (path === '/login') {
        setToken((await response.json()).token);
        setLoadFailed(false);
      } else if (path === '/logout') {
        clearSession();
      } else if (path === '/credentials/owner') {
        clearSession();
        setMessage('ownerPasswordChanged');
      } else if (path.startsWith('/credentials/')) {
        setMessage('credentialChanged');
        refresh.current();
      } else {
        setMessage('saved');
        refresh.current();
      }
      return true;
    } catch {
      setMessage('saveFailed');
      return false;
    } finally {
      setPending(false);
    }
  }

  const hours = hoursDraft ?? data?.settings;
  const translatedMessage = t(`admin.${message}`);

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">{t('admin.title')}</h1>
        {token && <button className={secondary} disabled={pending} onClick={() => void send('/logout', 'POST')}>{t('barber.logout')}</button>}
      </header>
      {message && <p role={['saved', 'credentialChanged', 'ownerPasswordChanged'].includes(message) ? 'status' : 'alert'} className={['saved', 'credentialChanged', 'ownerPasswordChanged'].includes(message) ? 'text-emerald-300' : 'text-red-300'}>{translatedMessage.startsWith('admin.') ? t('admin.saveFailed') : translatedMessage}</p>}
      {!token && (
        <form className={`${panel} max-w-md`} onSubmit={(event) => {
          event.preventDefault();
          void send('/login', 'POST', { password });
          setPassword('');
        }}>
          <label className="block" htmlFor="owner-password">{t('admin.password')}</label>
          <input id="owner-password" className={field} type="password" required autoComplete="current-password" maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className={primary} disabled={pending}>{t('barber.login')}</button>
        </form>
      )}
      {token && loadFailed && <button className={secondary} onClick={() => refresh.current()}>{t('settings.retry')}</button>}
      {token && !data && !loadFailed && <p role="status">{t('barber.loading')}</p>}
      {token && data && hours && (
        <>
          <section className={panel}>
            <h2 className="text-xl font-bold text-[#F2C754]">{t('admin.todayStats')}</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statuses.map((status) => <div key={status} className="rounded-xl bg-[#111827] p-3"><dt>{t(`admin.count_${status}`)}</dt><dd className="text-2xl font-bold">{data.stats[status]}</dd></div>)}
              <div className="rounded-xl bg-[#111827] p-3"><dt>{t('admin.averageWait')}</dt><dd className="text-2xl font-bold">{data.stats.averageWaitMinutes === null ? '—' : `${data.stats.averageWaitMinutes} ${t('home.minutes')}`}</dd></div>
            </dl>
          </section>
          <section className={panel}>
            <h2 className="text-xl font-bold text-[#F2C754]">{t('admin.hours')}</h2>
            <p>{t(data.settings.salonOpen ? 'display.open' : 'display.closed')} · {t(data.settings.reasonCode ? `settings.${data.settings.reasonCode}` : 'settings.onlineOpen')} · {t('settings.cutoff')} {data.settings.cutoffTime}</p>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (event) => {
              event.preventDefault();
              const { openTime, closeTime, onlineJoiningEnabled } = hours;
              if (await send('/settings', 'PATCH', { openTime, closeTime, onlineJoiningEnabled })) setHoursDraft(null);
            }}>
              <label className="space-y-1">{t('admin.openTime')}<input className={field} required type="time" value={hours.openTime} onChange={(event) => setHoursDraft({ ...hours, openTime: event.target.value })} /></label>
              <label className="space-y-1">{t('admin.closeTime')}<input className={field} required type="time" value={hours.closeTime} onChange={(event) => setHoursDraft({ ...hours, closeTime: event.target.value })} /></label>
              <label className="flex min-h-11 items-center gap-3 sm:col-span-2"><input className="h-5 w-5 accent-[#D4A017]" type="checkbox" checked={hours.onlineJoiningEnabled} onChange={(event) => setHoursDraft({ ...hours, onlineJoiningEnabled: event.target.checked })} />{t('admin.onlineJoining')}</label>
              <button className={`${primary} sm:col-span-2 sm:justify-self-start`} disabled={pending}>{t('admin.saveHours')}</button>
            </form>
          </section>
          <section className={panel}>
            <h2 className="text-xl font-bold text-[#F2C754]">{t('admin.barberManagement')}</h2>
            {data.barbers.length === 0 && <p>{t('admin.noBarbers')}</p>}
            {data.barbers.map((barber) => {
              const onDuty = barber.is_on_duty === 1 && barber.status !== 'off_duty';
              return (
                <div key={barber.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#111827] p-3">
                  <div><h3 className="font-bold">{barber.name}</h3><p>{t(`barber.state_${onDuty ? barber.status : 'off_duty'}`)}</p>{barber.hasActiveAssignment && <p className="text-sm text-[#F2C754]">{t('admin.activeAssignment')}</p>}</div>
                  <button className={secondary} disabled={pending || (onDuty && barber.hasActiveAssignment)} onClick={() => void send(`/barbers/${encodeURIComponent(barber.id)}/duty`, 'PATCH', { onDuty: !onDuty })}>{t(onDuty ? 'admin.takeOffDuty' : 'admin.putOnDuty')}</button>
                </div>
              );
            })}
          </section>
          <StaffAccess receptionistConfigured={data.receptionistCredentialConfigured} barbers={data.barbers} pending={pending}
            change={(id, fields) => send(`/credentials/${encodeURIComponent(id)}`, 'PATCH', fields)} />
          <section className={panel}>
            <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-[#F2C754]">{t('admin.serviceManagement')}</h2><button className={primary} disabled={pending} onClick={() => setEditingService('new')}>{t('admin.addService')}</button></header>
            {editingService && <ServiceEditor key={editingService === 'new' ? 'new' : editingService.id} service={editingService === 'new' ? undefined : editingService} pending={pending} cancel={() => setEditingService(null)} save={async (service) => {
              const id = editingService === 'new' ? null : editingService.id;
              if (await send(id ? `/services/${encodeURIComponent(id)}` : '/services', id ? 'PATCH' : 'POST', service)) setEditingService(null);
            }} />}
            {data.services.length === 0 && <p>{t('settings.noServices')}</p>}
            {data.services.map((service) => (
              <div key={service.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#111827] p-3">
                <div className="min-w-0"><h3 className="break-words font-bold">{language === 'gu' ? service.name_gu : service.name_en}</h3><p>₹{service.price} · {service.duration_minutes} {t('home.minutes')} · {t(service.is_active ? 'admin.active' : 'admin.inactive')}</p></div>
                <div className="flex flex-wrap gap-2">
                  <button className={secondary} disabled={pending} onClick={() => setEditingService(service)}>{t('admin.edit')}</button>
                  <button className={secondary} disabled={pending} onClick={() => void send(`/services/${encodeURIComponent(service.id)}`, 'PATCH', { is_active: service.is_active ? 0 : 1 })}>{t(service.is_active ? 'admin.deactivate' : 'admin.activate')}</button>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function ServiceEditor({ service, pending, save, cancel }: {
  service?: Service;
  pending: boolean;
  save: (service: Omit<Service, 'id'>) => Promise<void>;
  cancel: () => void;
}) {
  const { t } = useTranslation();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void save({
      name_en: String(form.get('nameEn') ?? ''),
      name_gu: String(form.get('nameGu') ?? ''),
      category: String(form.get('category')) as ServiceCategory,
      price: Number(form.get('price')),
      duration_minutes: Number(form.get('duration')),
      is_active: form.has('active') ? 1 : 0,
    });
  }
  return (
    <form className="grid gap-3 rounded-xl border border-[#D4A017]/60 p-3 sm:grid-cols-2" onSubmit={submit}>
      <h3 className="font-bold sm:col-span-2">{t(service ? 'admin.editService' : 'admin.addService')}</h3>
      <label>{t('admin.nameEn')}<input required maxLength={100} className={field} name="nameEn" defaultValue={service?.name_en} /></label>
      <label>{t('admin.nameGu')}<input required maxLength={100} className={field} name="nameGu" defaultValue={service?.name_gu} /></label>
      <label>{t('admin.category')}<select className={field} name="category" defaultValue={service?.category ?? 'hair'}>{categories.map((category) => <option key={category} value={category}>{t(`join.${categoryKey[category]}`)}</option>)}</select></label>
      <label>{t('admin.price')}<input required className={field} name="price" type="number" min={0} step={1} defaultValue={service?.price} /></label>
      <label>{t('admin.duration')}<input required className={field} name="duration" type="number" min={1} max={1440} step={1} defaultValue={service?.duration_minutes} /></label>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-[#D4A017]" name="active" defaultChecked={service?.is_active !== 0} />{t('admin.active')}</label>
      <div className="flex flex-wrap gap-2 sm:col-span-2"><button className={primary} disabled={pending}>{t('admin.saveService')}</button><button type="button" className={secondary} disabled={pending} onClick={cancel}>{t('admin.cancel')}</button></div>
    </form>
  );
}
