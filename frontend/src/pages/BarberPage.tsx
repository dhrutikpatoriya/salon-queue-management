import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from '../i18n/LanguageContext';
import { Play, CheckSquare, Coffee } from 'lucide-react';

export const BarberPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const { t } = useTranslation();
  const barberName = name || 'Ravi';

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#D4A017]/15 border border-[#D4A017]/40 text-[#D4A017] text-xs font-semibold">
          {t('badge.step1')}
        </span>
        <span className="text-xs text-gray-400">Route: /barber/:name</span>
      </div>

      <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-[#374151] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#D4A017]/20 text-[#D4A017] flex items-center justify-center font-bold text-lg">
              {barberName[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{barberName}</h1>
              <p className="text-xs text-emerald-400 font-medium">On Duty · Available</p>
            </div>
          </div>
          <button
            disabled
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#374151] text-xs text-gray-300 cursor-not-allowed"
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>{t('barber.toggleBreak')}</span>
          </button>
        </div>

        {/* Assigned Customer Card */}
        <div className="p-4 rounded-xl bg-[#111827] border border-[#374151] space-y-3">
          <span className="text-xs font-bold text-[#D4A017] uppercase tracking-wider">
            {t('barber.assignedCustomer')}
          </span>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-white">Token S-14</p>
              <p className="text-xs text-gray-400">Haircut + Beard Trim (45 min)</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-md bg-[#D4A017]/20 text-[#D4A017] font-semibold">
              Called
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              disabled
              className="py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#B8860B] text-[#111827] font-bold text-xs cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{t('barber.startService')}</span>
            </button>
            <button
              disabled
              className="py-2.5 rounded-xl bg-[#374151] text-gray-400 font-bold text-xs cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{t('barber.doneService')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
