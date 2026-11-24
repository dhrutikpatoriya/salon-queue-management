import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n/LanguageContext';
import { DEMO_QUEUE_STATS, SALON_BARBERS, SALON_SERVICES } from '../data/salonData';
import { Scissors, Clock, Users, ArrowRight, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';

export const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('salon_active_ticket_id');
    if (saved) {
      setActiveTicketId(saved);
    }
  }, []);

  return (
    <div className="space-y-5 sm:space-y-6 max-w-3xl mx-auto pb-10 w-full min-w-0 overflow-x-hidden">
      {/* Top Step Badge & Route Info */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4A017]/15 border border-[#D4A017]/40 text-[#D4A017] text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Step 3 — Live Queue Active</span>
        </span>
        <span className="text-xs text-gray-400 font-mono bg-[#1F2937] px-2.5 py-1 rounded-md border border-[#374151]">
          Route: /
        </span>
      </div>

      {/* Active Ticket Banner if User Already Joined */}
      {activeTicketId && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-[#D4A017]/20 to-[#B8860B]/10 border-2 border-[#D4A017] text-white flex items-center justify-between gap-3 shadow-lg shadow-[#D4A017]/10 animate-in fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#D4A017] text-[#111827] flex items-center justify-center font-bold shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#D4A017] uppercase tracking-wider">Active Queue Spot</p>
              <p className="text-sm font-semibold text-white truncate">You have an active spot in queue</p>
            </div>
          </div>
          <Link
            to={`/status/${activeTicketId}`}
            className="px-3.5 py-2 rounded-lg bg-[#D4A017] hover:bg-[#B8860B] text-[#111827] text-xs font-black shrink-0 transition-colors shadow"
          >
            Track Status →
          </Link>
        </div>
      )}

      {/* Demo Data Disclaimer (Required by User Adjustment 1) */}
      <div className="bg-[#1F2937]/80 border border-[#D4A017]/40 rounded-xl p-3 sm:p-3.5 flex items-start gap-2.5 sm:gap-3 shadow-md">
        <ShieldAlert className="w-5 h-5 text-[#D4A017] shrink-0 mt-0.5" />
        <div className="text-xs text-gray-300 min-w-0">
          <span className="font-bold text-[#D4A017] uppercase tracking-wider block mb-0.5 text-[11px]">
            {t('badge.demoData')}
          </span>
          <p className="leading-relaxed">{t('home.demoDisclaimer')}</p>
        </div>
      </div>

      {/* Hero Salon Banner & Live Queue Card */}
      <div className="bg-[#1F2937] border border-[#374151] rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-xl text-center space-y-5 sm:space-y-6">
        <div className="space-y-2.5 sm:space-y-3">
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-gradient-to-tr from-[#D4A017] to-[#F5D061] text-[#111827] flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
            <Scissors className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight break-words">
            {t('salonName')}
          </h1>
          <p className="text-xs sm:text-sm text-gray-300 max-w-md mx-auto">
            {t('home.subtitle')}
          </p>

          {/* Opening Status Badge */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold max-w-full truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span className="truncate">{t('openStatus')} ({DEMO_QUEUE_STATS.operatingHours})</span>
          </div>
        </div>

        {/* Live Queue Summary Box */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1">
          <div className="bg-[#111827] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[#374151] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4A017]" />
              <span className="text-[9px] sm:text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#374151] text-[#D4A017] shrink-0">
                {t('badge.demoData')}
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-white text-center my-1">
              {DEMO_QUEUE_STATS.waitingCount}
            </p>
            <p className="text-[11px] sm:text-xs text-gray-400 font-medium text-center truncate">
              {t('home.waitingCount')}
            </p>
          </div>

          <div className="bg-[#111827] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[#374151] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4A017]" />
              <span className="text-[9px] sm:text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#374151] text-[#D4A017] shrink-0">
                {t('badge.demoData')}
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-[#D4A017] text-center my-1">
              ~{DEMO_QUEUE_STATS.estimatedWaitMinutes} <span className="text-xs font-semibold text-gray-300">{t('home.minutes')}</span>
            </p>
            <p className="text-[11px] sm:text-xs text-gray-400 font-medium text-center truncate">
              {t('home.estWait')}
            </p>
          </div>
        </div>

        {/* Queue Open Badge & Join Action */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{t('home.queueStatus')}</span>
          </div>

          <Link
            to="/join"
            className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#D4A017] via-[#E6B834] to-[#B8860B] hover:brightness-110 active:scale-[0.99] text-[#111827] font-black text-sm sm:text-base transition-all shadow-lg shadow-[#D4A017]/20 group cursor-pointer"
          >
            <span>{t('home.joinButton')}</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform shrink-0" />
          </Link>
        </div>
      </div>

      {/* Today's Barbers on Duty Section */}
      <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-[#374151] pb-3">
          <div className="min-w-0 flex-1 mr-2">
            <h2 className="text-sm sm:text-base font-bold text-white truncate">{t('home.barbersTitle')}</h2>
            <p className="text-[11px] sm:text-xs text-gray-400 truncate">{t('home.barbersSubtitle')}</p>
          </div>
          <span className="text-[9px] sm:text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#111827] text-[#D4A017] border border-[#374151] shrink-0">
            {t('badge.demoData')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {SALON_BARBERS.map((barber) => {
            const isAvailable = barber.status === 'available';
            const isBusy = barber.status === 'busy';

            return (
              <div
                key={barber.id}
                className="bg-[#111827] p-3.5 sm:p-4 rounded-xl border border-[#374151] flex flex-col justify-between hover:border-[#D4A017]/50 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[#D4A017] to-[#B8860B] text-[#111827] flex items-center justify-center font-bold text-sm shadow shrink-0">
                      {barber.name[0]}
                    </div>
                    {isAvailable && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        {t('home.statusAvailable')}
                      </span>
                    )}
                    {isBusy && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                        {t('home.statusBusy')}
                      </span>
                    )}
                    {!isAvailable && !isBusy && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 font-bold border border-gray-500/30">
                        {t('home.statusBreak')}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-white">{barber.name}</h3>
                  <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 line-clamp-1">
                    {t(barber.specializationKey)}
                  </p>
                </div>

                {barber.activeToken && (
                  <div className="mt-2.5 pt-2 border-t border-[#374151]/60 flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Serving now:</span>
                    <span className="font-bold text-[#D4A017] font-mono">{barber.activeToken}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Popular Services Highlights */}
      <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
        <h2 className="text-sm sm:text-base font-bold text-white border-b border-[#374151] pb-2">
          {t('home.servicesPreviewTitle')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
          {SALON_SERVICES.slice(0, 3).map((service) => (
            <div
              key={service.id}
              className="bg-[#111827] p-3 rounded-xl border border-[#374151] flex items-center justify-between text-xs min-h-[44px]"
            >
              <div className="min-w-0 flex-1 mr-2">
                <p className="font-semibold text-white truncate">{t(service.nameKey)}</p>
                <p className="text-gray-400 text-[11px]">{service.durationMinutes} {t('home.minutes')}</p>
              </div>
              <span className="font-bold text-[#D4A017] text-sm shrink-0">₹{service.price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
