import React, { useEffect, useState, ReactNode } from 'react';
import { Navbar } from './Navbar';
import { useTranslation } from '../i18n/LanguageContext';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface HealthData {
  status: string;
  uptime: number;
  database: {
    status: string;
    message: string;
  };
}

export const StandardLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-900 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 min-w-0">
        {children}
      </main>

      {/* Footer with Status Indicator */}
      <footer className="bg-[#111827] border-t border-[#374151] py-4 px-3 sm:px-6 text-xs text-gray-400 w-full">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D4A017] shrink-0"></span>
            <span className="break-words">{t('salonName')} — {t('tagline')}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span>{t('common.systemStatus')}:</span>
            {loading ? (
              <span className="text-amber-400">{t('common.connecting')}</span>
            ) : health?.database.status === 'connected' ? (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('common.connected')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-red-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Offline
              </span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
