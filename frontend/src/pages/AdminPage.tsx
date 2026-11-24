import React from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { Settings } from 'lucide-react';

export const AdminPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#D4A017]/15 border border-[#D4A017]/40 text-[#D4A017] text-xs font-semibold">
          {t('badge.step1')}
        </span>
        <span className="text-xs text-gray-400">Route: /admin</span>
      </div>

      <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-[#374151] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4A017]/20 text-[#D4A017] flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t('admin.title')}</h1>
              <p className="text-xs text-gray-300">{t('admin.description')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-300">{t('admin.queueSwitch')}</span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
              OPEN
            </span>
          </div>
        </div>

        {/* Today's Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-[#111827] border border-[#374151]">
            <p className="text-xs text-gray-400">Customers Served</p>
            <p className="text-2xl font-bold text-white mt-1">28</p>
          </div>
          <div className="p-4 rounded-xl bg-[#111827] border border-[#374151]">
            <p className="text-xs text-gray-400">Avg Wait Time</p>
            <p className="text-2xl font-bold text-[#D4A017] mt-1">18 min</p>
          </div>
          <div className="p-4 rounded-xl bg-[#111827] border border-[#374151]">
            <p className="text-xs text-gray-400">No-shows</p>
            <p className="text-2xl font-bold text-gray-300 mt-1">1</p>
          </div>
        </div>

        {/* Services Table Placeholder */}
        <div className="p-4 rounded-xl bg-[#111827] border border-[#374151] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#D4A017] uppercase tracking-wider">{t('admin.serviceManagement')}</h2>
            <button disabled className="text-xs px-2.5 py-1 rounded bg-[#374151] text-gray-400 cursor-not-allowed">
              + Add Service
            </button>
          </div>
          <div className="space-y-2 text-xs">
            {[
              { name: 'Haircut / હેરકટ', duration: '30 min', price: '₹150' },
              { name: 'Beard Trim / દાઢી ટ્રીમ', duration: '15 min', price: '₹80' },
              { name: 'Hair Spa / હેર સ્પા', duration: '45 min', price: '₹400' }
            ].map((s) => (
              <div key={s.name} className="flex items-center justify-between p-2.5 rounded-lg bg-[#1F2937] border border-[#374151]">
                <span className="font-medium text-white">{s.name}</span>
                <span className="text-gray-400">{s.duration}</span>
                <span className="text-[#D4A017] font-semibold">{s.price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
