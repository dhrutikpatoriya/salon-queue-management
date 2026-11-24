import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '../i18n/LanguageContext';
import { Scissors, Globe, Monitor, Home, UserPlus, Clock, ClipboardList, UserCheck, Settings } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { t, language, toggleLanguage } = useTranslation();
  const location = useLocation();

  const navItems = [
    { path: '/', label: t('nav.home'), icon: Home },
    { path: '/join', label: t('nav.join'), icon: UserPlus },
    { path: '/status/S-14', label: t('nav.status'), icon: Clock },
    { path: '/reception', label: t('nav.reception'), icon: ClipboardList },
    { path: '/barber/Ravi', label: t('nav.barber'), icon: UserCheck },
    { path: '/display', label: t('nav.display'), icon: Monitor, isTv: true },
    { path: '/admin', label: t('nav.admin'), icon: Settings },
  ];

  const isActive = (path: string) => {
    if (path.startsWith('/status/')) return location.pathname.startsWith('/status');
    if (path.startsWith('/barber/')) return location.pathname.startsWith('/barber');
    return location.pathname === path;
  };

  return (
    <header className="bg-[#1F2937] text-white border-b border-[#374151] sticky top-0 z-50 shadow-md w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Brand Logo & Name - min-w-0 prevents mobile overflow */}
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group min-w-0 flex-1 mr-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#D4A017] to-[#B8860B] flex items-center justify-center text-[#111827] shadow-sm shrink-0">
              <Scissors className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-sm sm:text-base tracking-wide text-white group-hover:text-[#D4A017] transition-colors truncate block">
                {t('salonName')}
              </span>
              <p className="text-[10px] sm:text-xs text-[#9CA3AF] -mt-0.5 truncate block">
                {t('openStatus')}
              </p>
            </div>
          </Link>

          {/* Navigation Links for 7 Screens on Desktop */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-[#D4A017] text-[#111827] shadow-sm font-semibold'
                      : item.isTv
                      ? 'text-[#F5D061] hover:bg-[#374151]'
                      : 'text-gray-300 hover:text-white hover:bg-[#374151]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Language Switch Button - shrink-0 with comfortable touch target */}
          <div className="flex items-center shrink-0">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#D4A017]/60 text-xs font-medium bg-[#111827]/80 text-[#D4A017] hover:bg-[#D4A017] hover:text-[#111827] transition-all cursor-pointer shadow-sm min-h-[38px]"
              title="Toggle English / Gujarati"
              aria-label="Toggle language"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] sm:text-xs font-semibold">{t('languageLabel')}</span>
              <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-black/40 font-bold ml-0.5">
                {language.toUpperCase()}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Scrollable Navigation Bar */}
        <div className="flex lg:hidden overflow-x-auto py-2 gap-1.5 border-t border-[#374151]/50 no-scrollbar w-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1 whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 min-h-[34px] transition-colors ${
                  active
                    ? 'bg-[#D4A017] text-[#111827] font-bold shadow-sm'
                    : 'text-gray-300 hover:bg-[#374151] hover:text-white bg-[#111827]/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
};
