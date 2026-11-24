import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/LanguageContext';
import { useSalonCatalog } from '../utils/useSalonCatalog';
import { JoinQueueFormState, JoinQueueValidationErrors } from '../types/salon';
import {
  ArrowLeft,
  User,
  Check,
  AlertCircle,
  Clock,
  Scissors,
  CheckCircle2,
  Search,
  Loader2
} from 'lucide-react';

export const JoinPage: React.FC = () => {
  const { t, language } = useTranslation();
  const { catalog, failed, retry } = useSalonCatalog();
  const status = catalog?.status;
  const barbers = catalog?.barbers;
  const services = catalog?.services;
  const onlineOpen = Boolean(status?.isOnlineJoiningOpen && !failed);
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  // Form state
  const [formState, setFormState] = useState<JoinQueueFormState>({
    customerName: '',
    phoneNumber: '',
    selectedServiceIds: ['haircut'], // default to 1 service
    barberPreference: 'any'
  });

  const [errors, setErrors] = useState<JoinQueueValidationErrors>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [maxWarning, setMaxWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [catalogNotice, setCatalogNotice] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Filtered services based on search query and category
  const filteredServices = useMemo(() => {
    return (services ?? []).filter((service) => {
      const matchesCategory =
        activeCategory === 'all' || service.category === activeCategory;
      const englishName = service.name_en.toLowerCase();
      const gujaratiName = service.name_gu.toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesSearch = englishName.includes(q) || gujaratiName.includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery, services]);

  // Selected services list and dynamic totals
  const selectedServices = useMemo(() => {
    return (services ?? []).filter((s) => formState.selectedServiceIds.includes(s.id));
  }, [formState.selectedServiceIds, services]);

  useEffect(() => {
    if (!services || selectedServices.length === formState.selectedServiceIds.length) return;
    setFormState((previous) => ({
      ...previous,
      selectedServiceIds: previous.selectedServiceIds.filter((id) => services.some((service) => service.id === id)),
    }));
    setCatalogNotice(true);
  }, [services, selectedServices.length, formState.selectedServiceIds.length]);

  const totalDuration = useMemo(() => {
    return selectedServices.reduce((acc, s) => acc + s.duration_minutes, 0);
  }, [selectedServices]);

  const totalPrice = useMemo(() => {
    return selectedServices.reduce((acc, s) => acc + s.price, 0);
  }, [selectedServices]);

  const estimatedWaitPreview = formState.barberPreference === 'any'
    ? status?.approxWaitMinutes
    : status?.barberWaitMinutes[formState.barberPreference];

  // Helper to sanitize phone input (handles country codes +91, 0, or spaces)
  const handlePhoneChange = (inputVal: string) => {
    let clean = inputVal.replace(/\D/g, '');
    if (clean.length === 12 && clean.startsWith('91')) {
      clean = clean.slice(2);
    } else if (clean.length === 11 && clean.startsWith('0')) {
      clean = clean.slice(1);
    }
    const finalNumber = clean.slice(0, 10);
    setFormState((prev) => ({ ...prev, phoneNumber: finalNumber }));
    if (errors.phoneNumber) {
      setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
    }
  };

  // Service toggle handler with strict 3-service max limit
  const toggleService = (serviceId: string) => {
    setCatalogNotice(false);
    const isSelected = formState.selectedServiceIds.includes(serviceId);
    if (isSelected) {
      setFormState((prev) => ({
        ...prev,
        selectedServiceIds: prev.selectedServiceIds.filter((id) => id !== serviceId)
      }));
      setMaxWarning(false);
      if (errors.services) {
        setErrors((prev) => ({ ...prev, services: undefined }));
      }
    } else {
      if (formState.selectedServiceIds.length >= 3) {
        setMaxWarning(true);
        setTimeout(() => setMaxWarning(false), 3000);
        return;
      }
      setFormState((prev) => ({
        ...prev,
        selectedServiceIds: [...prev.selectedServiceIds, serviceId]
      }));
      setMaxWarning(false);
      if (errors.services) {
        setErrors((prev) => ({ ...prev, services: undefined }));
      }
    }
  };

  // Indian Phone validation (10 digits starting with 6, 7, 8, 9)
  const validateForm = (): boolean => {
    const newErrors: JoinQueueValidationErrors = {};

    if (!formState.customerName.trim()) {
      newErrors.customerName = t('join.errors.nameRequired');
    } else if (formState.customerName.trim().length < 2) {
      newErrors.customerName = t('join.errors.nameMinLength');
    }

    const cleanPhone = formState.phoneNumber.trim();
    const indianPhoneRegex = /^[6-9]\d{9}$/;
    if (!cleanPhone) {
      newErrors.phoneNumber = t('join.errors.phoneRequired');
    } else if (!indianPhoneRegex.test(cleanPhone)) {
      newErrors.phoneNumber = t('join.errors.phoneInvalid');
    }

    if (selectedServices.length === 0) {
      newErrors.services = t('join.errors.serviceRequired');
    } else if (formState.selectedServiceIds.length > 3) {
      newErrors.services = t('join.errors.maxServices');
    }

    if (formState.barberPreference !== 'any' && !barbers?.some(({ id }) => id === formState.barberPreference)) {
      newErrors.barberPreference = t('settings.barberUnavailable');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Real backend submission for Step 3
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!onlineOpen || selectedServices.length !== formState.selectedServiceIds.length || !validateForm()) {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/queue/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerName: formState.customerName.trim(),
          phoneNumber: formState.phoneNumber.trim(),
          serviceIds: selectedServices.map(({ id }) => id),
          barberPreference: formState.barberPreference
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        retry();
        throw new Error(data.reasonCode ? t(`settings.${data.reasonCode}`) : data.error || t('join.errors.joinFailed'));
      }

      const ticket = data.ticket;
      // Mandatory security requirement: store access token in localStorage
      if (ticket && ticket.id) {
        if (ticket.accessToken) {
          localStorage.setItem(`salon_access_token_${ticket.id}`, ticket.accessToken);
        }
        localStorage.setItem('salon_active_ticket_id', ticket.id);

        // Redirect to My Status screen
        if (data.isExistingSpot) {
          navigate(`/status/${ticket.id}?existing=true`);
        } else {
          navigate(`/status/${ticket.id}`);
        }
      } else {
        throw new Error('Invalid ticket response from server');
      }
    } catch (err: any) {
      setSubmitError(err.message || t('join.errors.joinFailed'));
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormState({
      customerName: '',
      phoneNumber: '',
      selectedServiceIds: services?.some(({ id }) => id === 'haircut') ? ['haircut'] : [],
      barberPreference: 'any'
    });
    setErrors({});
    setSubmitError(null);
    setMaxWarning(false);
    setCatalogNotice(false);
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl mx-auto pb-12 w-full min-w-0 overflow-x-hidden">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-300 hover:text-[#D4A017] transition-colors min-h-[38px] px-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('status.backToHome')}</span>
        </Link>

      </div>

      {/* Screen Title Header */}
      <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center gap-3 sm:gap-3.5">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#D4A017] to-[#B8860B] text-[#111827] flex items-center justify-center shadow-md shrink-0">
            <Scissors className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-black text-white truncate">{t('join.title')}</h1>
            <p className="text-xs sm:text-sm text-gray-300 truncate">{t('join.subtitle')}</p>
          </div>
        </div>
      </div>

      {status && <p role="status">{status.openTime}–{status.closeTime} · {t(status.reasonCode ? `settings.${status.reasonCode}` : 'settings.onlineOpen')} · {t('settings.cutoff')} {status.cutoffTime}</p>}
      {!status && !failed && <p role="status">{t('barber.loading')}</p>}
      {failed && <button type="button" className="min-h-11 rounded-xl border border-gray-500 px-4" onClick={retry}>{t('settings.retry')}</button>}

      {catalogNotice && <p role="status">{t('settings.reviewServices')}</p>}

      {/* Backend Submit Error Alert Banner */}
      {submitError && (
        <div className="p-4 rounded-xl bg-red-500/15 border-2 border-red-500/50 text-red-300 text-xs sm:text-sm flex items-start gap-3 shadow-lg animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-white">{t('join.errors.joinFailed')}</p>
            <p>{submitError}</p>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout (Form on Left, Sticky Summary on Right) */}
      <form ref={formRef} onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-5 sm:gap-6 items-start w-full min-w-0">
        {/* Left Column (2 cols): Input Sections */}
        <div className="lg:col-span-2 space-y-5 sm:space-y-6 w-full min-w-0">
          {/* Section 1: Customer Details */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-4 sm:p-6 shadow-lg space-y-4">
            <div className="flex items-center gap-2 border-b border-[#374151] pb-3">
              <User className="w-4 h-4 text-[#D4A017]" />
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                {t('join.customerDetails')}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Full Name */}
              <div className="space-y-1.5 min-w-0">
                <label className="text-xs font-semibold text-gray-300 block">
                  {t('join.nameLabel')} <span className="text-[#D4A017]">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formState.customerName}
                    onChange={(e) => {
                      setFormState((prev) => ({ ...prev, customerName: e.target.value }));
                      if (errors.customerName) setErrors((prev) => ({ ...prev, customerName: undefined }));
                    }}
                    placeholder={t('join.namePlaceholder')}
                    className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#111827] border text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4A017] transition-all ${
                      errors.customerName ? 'border-red-500' : 'border-[#374151]'
                    }`}
                  />
                </div>
                {errors.customerName && (
                  <p className="text-[11px] text-red-400 flex items-center gap-1 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.customerName}</span>
                  </p>
                )}
              </div>

              {/* Indian Phone Number */}
              <div className="space-y-1.5 min-w-0">
                <label className="text-xs font-semibold text-gray-300 block">
                  {t('join.phoneLabel')} <span className="text-[#D4A017]">*</span>
                </label>
                <div className="relative flex rounded-xl overflow-hidden border border-[#374151] focus-within:ring-2 focus-within:ring-[#D4A017] min-h-[44px]">
                  <span className="bg-[#374151] text-gray-300 px-3 flex items-center text-xs font-bold border-r border-[#374151] shrink-0 select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={formState.phoneNumber}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder={t('join.phonePlaceholder')}
                    className="min-w-0 flex-1 px-3.5 py-2.5 bg-[#111827] text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>
                {errors.phoneNumber ? (
                  <p className="text-[11px] text-red-400 flex items-center gap-1 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.phoneNumber}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400 leading-tight">{t('join.phoneHelper')}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Services Selection */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-4 sm:p-6 shadow-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#374151] pb-3">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-[#D4A017]" />
                <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                  {t('join.selectServices')}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#111827] border border-[#D4A017]/60 text-[#D4A017]">
                  {t('join.servicesCounter')}: {formState.selectedServiceIds.length} / 3
                </span>
              </div>
            </div>

            {/* Error or Max limit warning */}
            {errors.services && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errors.services}</span>
              </div>
            )}
            {maxWarning && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2 animate-bounce">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{t('join.maxServicesReached')} (3/3)</span>
              </div>
            )}

            {/* Search and Category Filters */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('join.searchPlaceholder')}
                  className="w-full min-h-[44px] pl-9 pr-4 py-2 rounded-xl bg-[#111827] border border-[#374151] text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#D4A017]"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs w-full">
                {[
                  { id: 'all', label: t('join.categoryAll') },
                  { id: 'hair', label: t('join.categoryHair') },
                  { id: 'beard', label: t('join.categoryBeard') },
                  { id: 'spa', label: t('join.categorySpa') },
                  { id: 'color', label: t('join.categoryColor') }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer min-h-[34px] shrink-0 ${
                      activeCategory === cat.id
                        ? 'bg-[#D4A017] text-[#111827] font-bold shadow'
                        : 'bg-[#111827] text-gray-400 hover:text-white border border-[#374151]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Services Grid - 1 col on mobile, 2 cols on tablet/desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-1">
              {filteredServices.map((service) => {
                const isSelected = formState.selectedServiceIds.includes(service.id);
                const isMaxReached = formState.selectedServiceIds.length >= 3;
                const isDisabled = !isSelected && isMaxReached;

                return (
                  <div
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between select-none relative min-h-[76px] ${
                      isSelected
                        ? 'bg-[#111827] border-[#D4A017] shadow-md shadow-[#D4A017]/10 ring-1 ring-[#D4A017]'
                        : isDisabled
                        ? 'bg-[#111827]/40 border-[#374151]/50 opacity-50 cursor-not-allowed'
                        : 'bg-[#111827] border-[#374151] hover:border-gray-500 hover:bg-[#1a2332]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`font-bold text-sm ${isSelected ? 'text-[#D4A017]' : 'text-white'} truncate`}>
                          {language === 'gu' ? service.name_gu : service.name_en}
                        </p>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-[#D4A017] text-[#111827]'
                            : 'border border-[#374151] text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#374151]/60 text-xs">
                      <span className="text-gray-400 flex items-center gap-1 text-[11px]">
                        <Clock className="w-3 h-3 text-gray-500 shrink-0" />
                        {service.duration_minutes} {t('home.minutes')}
                      </span>
                      <span className="font-extrabold text-[#D4A017] text-sm">
                        ₹{service.price}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Barber Selection */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-4 sm:p-6 shadow-lg space-y-4">
            <div className="flex items-center gap-2 border-b border-[#374151] pb-3">
              <User className="w-4 h-4 text-[#D4A017]" />
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                {t('join.selectBarber')}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option: Any Barber (Fastest) */}
              <div
                onClick={() => setFormState((prev) => ({ ...prev, barberPreference: 'any' }))}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between min-h-[88px] ${
                  formState.barberPreference === 'any'
                    ? 'bg-[#111827] border-[#D4A017] shadow-md shadow-[#D4A017]/10 ring-1 ring-[#D4A017]'
                    : 'bg-[#111827] border-[#374151] hover:border-gray-500 hover:bg-[#1a2332]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#D4A017]/20 text-[#D4A017] mb-1">
                      {t('home.fastest')}
                    </span>
                    <h3 className="font-bold text-sm text-white">
                      {t('join.anyBarber')}
                    </h3>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      formState.barberPreference === 'any'
                        ? 'border-[#D4A017] bg-[#D4A017]'
                        : 'border-[#374151]'
                    }`}
                  >
                    {formState.barberPreference === 'any' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#111827]" />
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  {t('join.anyBarberDesc')}
                </p>
              </div>

              {/* Specific Barbers: Ravi, Amit, Imran */}
              {(barbers ?? []).map((barber) => {
                const isSelected = formState.barberPreference === barber.id;
                return (
                  <div
                    key={barber.id}
                    onClick={() => setFormState((prev) => ({ ...prev, barberPreference: barber.id }))}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between min-h-[88px] ${
                      isSelected
                        ? 'bg-[#111827] border-[#D4A017] shadow-md shadow-[#D4A017]/10 ring-1 ring-[#D4A017]'
                        : 'bg-[#111827] border-[#374151] hover:border-gray-500 hover:bg-[#1a2332]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#374151] text-gray-300 font-bold flex items-center justify-center text-xs">
                          {barber.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-white">{barber.name}</h3>
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-[#D4A017] bg-[#D4A017]'
                            : 'border-[#374151]'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#111827]" />}
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-[#374151]/50 flex items-center justify-between text-[11px]">
                      <span className="text-gray-400">{t('settings.status')}</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        {t(`barber.state_${barber.status}`)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {errors.barberPreference && <p role="alert">{errors.barberPreference}</p>}
        </div>

        {/* Right Column (1 col): Live Sticky Summary Card */}
        <div className="lg:col-span-1 lg:sticky lg:top-20 space-y-4 w-full min-w-0">
          <div className="bg-[#1F2937] border-2 border-[#D4A017]/50 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#374151] pb-3">
              <h2 className="text-sm font-extrabold text-white tracking-wide">
                {t('join.summaryTitle')}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-[#D4A017]/20 text-[#D4A017] font-bold">
                {selectedServices.length} {t('join.servicesCounter')}
              </span>
            </div>

            {/* Selected items list */}
            <div className="space-y-2 text-xs">
              {selectedServices.length === 0 ? (
                <div className="py-6 text-center text-gray-400 space-y-1">
                  <Scissors className="w-6 h-6 mx-auto opacity-30" />
                  <p className="text-xs">{t('join.errors.serviceRequired')}</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {selectedServices.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between py-1 border-b border-[#374151]/40 last:border-0"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-semibold text-white truncate text-xs">
                          {language === 'gu' ? service.name_gu : service.name_en}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {service.duration_minutes} {t('home.minutes')}
                        </p>
                      </div>
                      <span className="font-bold text-[#D4A017] shrink-0">
                        ₹{service.price}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Calculations breakdown */}
            <div className="border-t border-[#374151] pt-3 space-y-2 text-xs">
              <div className="flex justify-between items-center text-gray-300">
                <span>{t('join.selectedBarber')}:</span>
                <span className="font-semibold text-white">
                  {formState.barberPreference === 'any'
                    ? t('join.anyBarber')
                    : barbers?.find((b) => b.id === formState.barberPreference)?.name ?? t('settings.barberUnavailable')}
                </span>
              </div>

              <div className="flex justify-between items-center text-gray-300">
                <span>{t('join.totalDuration')}:</span>
                <span className="font-semibold text-white">{totalDuration} {t('home.minutes')}</span>
              </div>

              <div className="p-3 rounded-xl bg-[#111827] border border-[#374151] space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-400">{t('join.estWait')}:</span>
                  <span className="font-black text-[#D4A017] text-sm">{estimatedWaitPreview == null ? t('status.waitUnavailable') : `~${estimatedWaitPreview} ${t('home.minutes')}`}</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight">
                  *{t('status.waitNote')}
                </p>
              </div>

              <div className="flex justify-between items-center pt-2 text-base font-extrabold text-white">
                <span>{t('join.totalAmount')}:</span>
                <span className="text-[#D4A017] text-lg">₹{totalPrice}</span>
              </div>
            </div>

            {/* Actions with 44px+ touch targets */}
            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || selectedServices.length === 0 || !onlineOpen}
                className={`w-full min-h-[48px] py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#B8860B] text-[#111827] font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
                  isSubmitting || selectedServices.length === 0 || !onlineOpen
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:brightness-110 active:scale-[0.99] cursor-pointer'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('join.joiningButton')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>{t('join.confirmButton')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={isSubmitting}
                className="w-full min-h-[38px] py-2 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              >
                {t('join.resetButton')}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
