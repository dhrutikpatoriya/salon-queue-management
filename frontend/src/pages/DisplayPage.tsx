import React from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { Link } from 'react-router-dom';
import { Scissors, Globe, ArrowLeft } from 'lucide-react';

export const DisplayPage: React.FC = () => {
  const { t, toggleLanguage } = useTranslation();

  return (
    // DEDICATED FULLSCREEN LAYOUT (NO NAVBAR) FOR 1920x1080 TV DISPLAY
    <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col p-6 sm:p-10 select-none font-sans">
      {/* Top Header Bar for TV */}
      <div className="flex items-center justify-between border-b border-[#374151] pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#D4A017] text-[#111827] flex items-center justify-center shadow-lg">
            <Scissors className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-wide text-white">{t('salonName')}</h1>
            <p className="text-sm text-[#D4A017] font-semibold">{t('display.subtitle')}</p>
          </div>
        </div>

        {/* Exit & Language Switch on TV */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#D4A017]/60 text-xs font-semibold bg-[#1F2937] text-[#D4A017] hover:bg-[#D4A017] hover:text-[#111827] transition-all cursor-pointer shadow-md"
          >
            <Globe className="w-4 h-4" />
            <span>{t('languageLabel')}</span>
          </button>
          <Link
            to="/"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1F2937] text-gray-300 hover:text-white border border-[#374151] text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('display.exitTv')}</span>
          </Link>
        </div>
      </div>

      {/* Main TV Screen Content */}
      <div className="flex-1 grid lg:grid-cols-2 gap-8 my-8 items-stretch">
        {/* Left Column: Now Serving (In Chair) */}
        <div className="bg-[#111827] border-2 border-[#D4A017]/60 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#374151] pb-4">
              <span className="text-xl sm:text-2xl font-black text-[#D4A017] uppercase tracking-wider">
                {t('display.nowServing')}
              </span>
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>

            <div className="space-y-4 pt-2">
              {[
                { barber: 'Ravi', token: 'S-12', service: 'Haircut' },
                { barber: 'Amit', token: 'S-14', service: 'Haircut + Beard' },
                { barber: 'Imran', token: 'S-15', service: 'Hair Spa' }
              ].map((item) => (
                <div
                  key={item.barber}
                  className="bg-[#1F2937] border border-[#374151] rounded-2xl p-5 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold">{item.barber}</p>
                    <p className="text-xs text-[#D4A017]">{item.service}</p>
                  </div>
                  <div className="text-4xl font-black text-white tracking-widest bg-[#111827] px-4 py-2 rounded-xl border border-[#D4A017]/40">
                    {item.token}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-gray-500 pt-4 text-center">
            {t('common.tvNote')}
          </div>
        </div>

        {/* Right Column: Up Next (Next 5 in line) */}
        <div className="bg-[#111827] border border-[#374151] rounded-3xl p-6 sm:p-8 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#374151] pb-4 mb-4">
            <span className="text-xl sm:text-2xl font-bold text-gray-200 uppercase tracking-wider">
              {t('display.upNext')}
            </span>
            <span className="text-xs text-gray-400">Estimated times</span>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-around">
            {[
              { token: 'S-16', barber: 'Any barber', wait: '~10 min' },
              { token: 'S-17', barber: 'Ravi', wait: '~18 min' },
              { token: 'S-18', barber: 'Amit', wait: '~25 min' },
              { token: 'S-19', barber: 'Any barber', wait: '~32 min' },
              { token: 'S-20', barber: 'Imran', wait: '~40 min' }
            ].map((queueItem, idx) => (
              <div
                key={queueItem.token}
                className="bg-[#1F2937]/70 border border-[#374151]/80 rounded-2xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#374151] text-gray-300 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="text-xl font-bold text-white tracking-wider">{queueItem.token}</span>
                    <p className="text-xs text-gray-400">{queueItem.barber}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-[#D4A017]">{queueItem.wait}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
