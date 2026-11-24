import { Link } from 'react-router-dom';
import { ArrowRight, Scissors } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { useSalonCatalog } from '../utils/useSalonCatalog';

export function HomePage() {
  const { t, language } = useTranslation();
  const { catalog, failed, retry } = useSalonCatalog();
  const activeTicketId = localStorage.getItem('salon_active_ticket_id');
  const status = catalog?.status;
  const joinClass = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D4A017] px-4 font-bold text-[#111827]';
  const wait = status?.approxWaitMinutes;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8 text-white">
      {activeTicketId && (
        <Link className="block rounded-xl border border-[#D4A017] p-4 text-[#F2C754]" to={`/status/${activeTicketId}`}>{t('settings.trackStatus')}</Link>
      )}
      <section className="space-y-5 rounded-3xl border border-gray-600 bg-[#1F2937] p-5 text-center sm:p-8">
        <Scissors className="mx-auto h-11 w-11 text-[#D4A017]" aria-hidden="true" />
        <h1 className="text-3xl font-black">{t('salonName')}</h1>
        <p className="text-gray-300">{t('home.subtitle')}</p>
        {status && (
          <>
            <p className="font-semibold text-[#F2C754]">{t(status.salonOpen ? 'display.open' : 'display.closed')} · {status.openTime}–{status.closeTime}</p>
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#111827] p-4"><dt>{t('home.waitingCount')}</dt><dd className="text-2xl font-bold">{status.waitingCount}</dd></div>
              <div className="rounded-xl bg-[#111827] p-4"><dt>{t('home.estWait')}</dt><dd className="font-bold text-[#F2C754]">{wait == null ? t('status.waitUnavailable') : `~${wait} ${t('home.minutes')}`}</dd></div>
            </dl>
            <p role="status">{status.reasonCode ? t(`settings.${status.reasonCode}`) : t('settings.onlineOpen')} · {t('settings.cutoff')} {status.cutoffTime}</p>
          </>
        )}
        {failed && <button className="min-h-11 rounded-xl border border-gray-500 px-4" onClick={retry}>{t('settings.retry')}</button>}
        {!status && !failed && <p role="status">{t('barber.loading')}</p>}
        {status?.isOnlineJoiningOpen && !failed
          ? <Link className={joinClass} to="/join">{t('home.joinButton')} <ArrowRight aria-hidden="true" size={20} /></Link>
          : <button className={`${joinClass} opacity-50`} disabled>{t('home.joinButton')}</button>}
      </section>
      {catalog && (
        <>
          <section className="space-y-3 rounded-2xl bg-[#1F2937] p-5">
            <h2 className="text-lg font-bold">{t('home.barbersTitle')}</h2>
            {catalog.barbers.length === 0 && <p>{t('display.noBarbers')}</p>}
            <div className="grid gap-2 sm:grid-cols-3">
              {catalog.barbers.map((barber) => (
                <p key={barber.id} className="rounded-xl bg-[#111827] p-3">{barber.name} · {t(`barber.state_${barber.status}`)}</p>
              ))}
            </div>
          </section>
          <section className="space-y-3 rounded-2xl bg-[#1F2937] p-5">
            <h2 className="text-lg font-bold">{t('home.servicesPreviewTitle')}</h2>
            {catalog.services.length === 0 && <p>{t('settings.noServices')}</p>}
            <div className="grid gap-2 sm:grid-cols-3">
              {catalog.services.slice(0, 3).map((service) => (
                <p key={service.id} className="break-words rounded-xl bg-[#111827] p-3">{language === 'gu' ? service.name_gu : service.name_en} · ₹{service.price} · {service.duration_minutes} {t('home.minutes')}</p>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
