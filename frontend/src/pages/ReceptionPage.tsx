import React from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { ClipboardList, PlusCircle } from 'lucide-react';

export const ReceptionPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#D4A017]/15 border border-[#D4A017]/40 text-[#D4A017] text-xs font-semibold">
          {t('badge.step1')}
        </span>
        <span className="text-xs text-gray-400">Route: /reception</span>
      </div>

      <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#374151] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4A017]/20 text-[#D4A017] flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t('reception.title')}</h1>
              <p className="text-xs text-gray-300">{t('reception.description')}</p>
            </div>
          </div>
          <button
            disabled
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D4A017] text-[#111827] font-bold text-xs cursor-not-allowed opacity-80"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('reception.addWalkIn')}</span>
          </button>
        </div>

        {/* Barbers Overview Grid */}
        <div className="grid sm:grid-cols-3 gap-3">
          {['Ravi', 'Amit', 'Imran'].map((barber) => (
            <div key={barber} className="p-3.5 rounded-xl bg-[#111827] border border-[#374151] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white">{barber}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">Available</span>
              </div>
              <p className="text-xs text-gray-400">Current: None</p>
              <button
                disabled
                className="w-full py-1.5 rounded-lg bg-[#374151] text-xs text-gray-400 cursor-not-allowed"
              >
                {t('reception.callNext')}
              </button>
            </div>
          ))}
        </div>

        {/* Live Queue Table Placeholder */}
        <div className="p-4 rounded-xl bg-[#111827] border border-[#374151] space-y-2">
          <h2 className="text-xs font-bold text-[#D4A017] uppercase tracking-wider">{t('reception.waitingList')}</h2>
          <div className="text-xs text-gray-400 p-4 text-center border border-dashed border-[#374151] rounded-lg">
            Queue records will appear here in Step 3 & 4.
          </div>
        </div>
      </div>
    </div>
  );
};
