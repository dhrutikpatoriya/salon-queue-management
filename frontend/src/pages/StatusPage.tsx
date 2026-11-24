import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from '../i18n/LanguageContext';
import { ArrowLeft } from 'lucide-react';

export const StatusPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const token = id || 'S-14';

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>
        <span className="text-xs text-gray-400">Route: /status/:id</span>
      </div>

      <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-6">
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-wider text-[#D4A017] font-bold">
            {t('status.tokenLabel')}
          </span>
          <div className="text-5xl sm:text-6xl font-black text-white tracking-wider my-2">
            {token}
          </div>
          <p className="text-xs text-gray-400">{t('status.title')}</p>
        </div>

        {/* Live Queue Cards */}
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="p-4 rounded-xl bg-[#111827] border border-[#374151]">
            <span className="text-xs text-gray-400">{t('status.positionLabel')}</span>
            <p className="text-xl font-bold text-white mt-1">2nd in line</p>
          </div>
          <div className="p-4 rounded-xl bg-[#111827] border border-[#374151]">
            <span className="text-xs text-gray-400">{t('status.waitingLabel')}</span>
            <p className="text-xl font-bold text-[#D4A017] mt-1">~15 mins</p>
          </div>
        </div>

        {/* Status Pipeline Placeholder */}
        <div className="p-4 rounded-xl bg-[#111827] border border-[#374151] space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-300">
            <span className="text-[#D4A017]">1. Waiting</span>
            <span className="text-gray-500">2. Called</span>
            <span className="text-gray-500">3. In chair</span>
            <span className="text-gray-500">4. Done</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#374151] overflow-hidden">
            <div className="w-1/4 h-full bg-[#D4A017]"></div>
          </div>
        </div>

        <div className="pt-2">
          <button
            disabled
            className="w-full py-2.5 rounded-xl border border-red-500/40 text-red-400 text-xs font-medium cursor-not-allowed hover:bg-red-500/10"
          >
            {t('status.cancelButton')} ({t('badge.placeholder')})
          </button>
        </div>
      </div>
    </div>
  );
};
