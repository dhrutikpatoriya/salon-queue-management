import React, { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n/LanguageContext';
import { SALON_SERVICES, SALON_BARBERS } from '../data/salonData';
import { JoinQueueFormState, JoinQueueValidationErrors, SalonService } from '../types/salon';
import {
  ArrowLeft,
  User,
  Check,
  X,
  AlertCircle,
  Clock,
  Sparkles,
  Scissors,
  CheckCircle2,
  Search,
  ShieldAlert
} from 'lucide-react';

export const JoinPage: React.FC = () => {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);

  // Clean form state adhering to JoinQueueFormState interface
  const [formState, setFormState] = useState<JoinQueueFormState>({
    customerName: '',
    phoneNumber: '',
    selectedServiceIds: ['haircut'], // default to 1 service for convenience
    barberPreference: 'any'
  });

  const [errors, setErrors] = useState<JoinQueueValidationErrors>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showDemoConfirmation, setShowDemoConfirmation] = useState(false);
  const [maxWarning, setMaxWarning] = useState(false);

  // Filtered services based on search query and category
  const filteredServices = useMemo(() => {
    return SALON_SERVICES.filter((service) => {
      const matchesCategory =
        activeCategory === 'all' || service.category === activeCategory;
      const localizedName = t(service.nameKey).toLowerCase();
      const defaultName = service.defaultName.toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesSearch = localizedName.includes(q) || defaultName.includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery, t]);

  // Selected services list and dynamic totals
  const selectedServices = useMemo(() => {
    return SALON_SERVICES.filter((s) => formState.selectedServiceIds.includes(s.id));
  }, [formState.selectedServiceIds]);

  const totalDuration = useMemo(() => {
    return selectedServices.reduce((acc, s) => acc + s.durationMinutes, 0);
  }, [selectedServices]);

  const totalPrice = useMemo(() => {
    return selectedServices.reduce((acc, s) => acc + s.price, 0);
  }, [selectedServices]);

  // Demo wait time approximation based on services & barber
  const demoEstimatedWait = useMemo(() => {
    const baseWait = 15;
    const additional = selectedServices.length * 5;
    const barberBonus = formState.barberPreference === 'amit' ? 15 : 0;
    return baseWait + additional + barberBonus;
  }, [selectedServices.length, formState.barberPreference]);

  // Helper to sanitize phone input (handles country codes +91, 0, or spaces)
  const handlePhoneChange = (inputVal: string) => {
    let clean = inputVal.replace(/\D/g, '');
    // If user pasted 12-digit number starting with 91, strip country code
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

    if (formState.selectedServiceIds.length === 0) {
      newErrors.services = t('join.errors.serviceRequired');
    } else if (formState.selectedServiceIds.length > 3) {
      newErrors.services = t('join.errors.maxServices');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setShowDemoConfirmation(true);
    } else {
      // Smoothly scroll to the top of the form so mobile users see the error immediately
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleReset = () => {
    setFormState({
      customerName: '',
      phoneNumber: '',
      selectedServiceIds: [],
      barberPreference: 'any'
    });
    setErrors({});
    setMaxWarning(false);
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
          <span>Back to Home</span>
        </Link>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4A017]/15 border border-[#D4A017]/40 text-[#D4A017] text-xs font-semibold shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
          {t('badge.step2')}
        </span>
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
              {filteredServices.map((service: SalonService) => {
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
                          {t(service.nameKey)}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">
                          {t(service.descriptionKey)}
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
                        {service.durationMinutes} {t('home.minutes')}
                      </span>
                      <span className="font-bold text-[#D4A017] text-sm">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {/* Option 1: Any Barber (Fastest) */}
              <div
                onClick={() => setFormState((prev) => ({ ...prev, barberPreference: 'any' }))}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between min-h-[64px] ${
                  formState.barberPreference === 'any'
                    ? 'bg-[#111827] border-[#D4A017] ring-1 ring-[#D4A017]'
                    : 'bg-[#111827] border-[#374151] hover:border-gray-500'
                }`}
              >
                <div className="min-w-0 flex-1 mr-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-xs sm:text-sm text-white">
                      {t('join.anyBarber')}
                    </span>
                    <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded bg-[#D4A017]/20 text-[#D4A017] font-bold">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{t('join.anyBarberDesc')}</p>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    formState.barberPreference === 'any'
                      ? 'border-[#D4A017] bg-[#D4A017]'
                      : 'border-gray-500'
                  }`}
                >
                  {formState.barberPreference === 'any' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#111827]" />
                  )}
                </div>
              </div>

              {/* Named Barbers */}
              {SALON_BARBERS.map((barber) => (
                <div
                  key={barber.id}
                  onClick={() => setFormState((prev) => ({ ...prev, barberPreference: barber.id }))}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between min-h-[64px] ${
                    formState.barberPreference === barber.id
                      ? 'bg-[#111827] border-[#D4A017] ring-1 ring-[#D4A017]'
                      : 'bg-[#111827] border-[#374151] hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                    <div className="w-8 h-8 rounded-full bg-[#374151] text-[#D4A017] font-bold text-xs flex items-center justify-center shrink-0">
                      {barber.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-white truncate">{barber.name}</span>
                        {barber.status === 'available' ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-semibold shrink-0">
                            {t('home.statusAvailable')}
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-semibold shrink-0">
                            {t('home.statusBusy')}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{t(barber.specializationKey)}</p>
                    </div>
                  </div>

                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      formState.barberPreference === barber.id
                        ? 'border-[#D4A017] bg-[#D4A017]'
                        : 'border-gray-500'
                    }`}
                  >
                    {formState.barberPreference === barber.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#111827]" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Live Sticky Queue Summary */}
        <div className="lg:col-span-1 lg:sticky lg:top-20 space-y-4 w-full min-w-0">
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#374151] pb-3">
              <h2 className="text-sm font-bold text-white tracking-wide">{t('join.summaryTitle')}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#111827] text-[#D4A017] border border-[#374151]">
                {t('badge.step2')}
              </span>
            </div>

            {/* Selected Services Tags */}
            <div className="space-y-2">
              <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider block">
                {t('join.totalServices')} ({selectedServices.length}/3)
              </span>

              {selectedServices.length === 0 ? (
                <p className="text-xs text-gray-500 italic p-3 bg-[#111827] rounded-lg text-center">
                  None selected yet
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {selectedServices.map((service) => (
                    <div
                      key={service.id}
                      className="p-2.5 rounded-lg bg-[#111827] border border-[#374151] flex items-center justify-between text-xs"
                    >
                      <div className="truncate mr-2">
                        <p className="font-semibold text-white truncate">{t(service.nameKey)}</p>
                        <p className="text-[10px] text-gray-400">{service.durationMinutes} min</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-[#D4A017]">₹{service.price}</span>
                        <button
                          type="button"
                          onClick={() => toggleService(service.id)}
                          className="text-gray-400 hover:text-red-400 cursor-pointer p-1 min-h-[30px] min-w-[30px] flex items-center justify-center rounded"
                          title="Remove"
                          aria-label={`Remove ${t(service.nameKey)}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total Duration and Price */}
            <div className="space-y-2 pt-2 border-t border-[#374151]/80 text-xs">
              <div className="flex justify-between items-center text-gray-300">
                <span>{t('join.totalDuration')}:</span>
                <span className="font-bold text-white text-sm">{totalDuration} {t('home.minutes')}</span>
              </div>

              <div className="flex justify-between items-center text-gray-300">
                <span>{t('join.selectedBarber')}:</span>
                <span className="font-bold text-[#D4A017] capitalize">
                  {formState.barberPreference === 'any'
                    ? t('join.anyBarber')
                    : SALON_BARBERS.find((b) => b.id === formState.barberPreference)?.name || 'Barber'}
                </span>
              </div>

              {/* Demo Estimated Wait Time */}
              <div className="p-3 rounded-xl bg-[#111827] border border-[#374151] space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-400">{t('join.estWait')}:</span>
                  <span className="font-black text-[#D4A017] text-sm">~{demoEstimatedWait} mins</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight">
                  *{t('join.demoWaitNote')} ({t('badge.demoData')})
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
                className="w-full min-h-[48px] py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#B8860B] hover:brightness-110 active:scale-[0.99] text-[#111827] font-black text-sm transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>{t('join.confirmButton')}</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="w-full min-h-[38px] py-2 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              >
                {t('join.resetButton')}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Demo Confirmation Preview Modal (Failure 1 & 2 fixes: fully responsive with max-h and scrollable content) */}
      {showDemoConfirmation && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm overflow-y-auto p-3 sm:p-4 flex min-h-full items-center justify-center animate-in fade-in"
        >
          <div className="bg-[#1F2937] border-2 border-[#D4A017] rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5 shadow-2xl relative my-auto max-h-[92vh] flex flex-col">
            <button
              type="button"
              onClick={() => setShowDemoConfirmation(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-white p-2 rounded-lg cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="text-center space-y-1.5 shrink-0 pt-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-full bg-[#D4A017]/20 text-[#D4A017] flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white">
                {t('join.confirmationModal.title')}
              </h2>
            </div>

            {/* Modal Body - Scrollable on small screens */}
            <div className="overflow-y-auto space-y-3.5 pr-1 flex-1">
              {/* Explicit Demo Notice per Adjustment 2 */}
              <div className="p-3 sm:p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-[#D4A017] shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <span className="font-bold text-[#D4A017] uppercase tracking-wider block text-[10px]">
                    {t('badge.previewOnly')}
                  </span>
                  <p className="font-bold text-white text-xs sm:text-sm">
                    &ldquo;{t('join.confirmationModal.demoNotice')}&rdquo;
                  </p>
                  <p className="text-[11px] text-gray-300">
                    {t('join.confirmationModal.readyForStep3')}
                  </p>
                </div>
              </div>

              {/* Summary of Validated Submission */}
              <div className="bg-[#111827] rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border border-[#374151] space-y-2 text-xs">
                <p className="font-bold text-gray-300 uppercase tracking-wider text-[10px] sm:text-[11px] border-b border-[#374151] pb-1.5">
                  {t('join.confirmationModal.detailsHeader')}
                </p>

                <div className="flex justify-between items-center py-0.5 gap-2">
                  <span className="text-gray-400 shrink-0">{t('join.confirmationModal.customer')}:</span>
                  <span className="font-semibold text-white truncate text-right">{formState.customerName}</span>
                </div>

                <div className="flex justify-between items-center py-0.5 gap-2">
                  <span className="text-gray-400 shrink-0">{t('join.confirmationModal.phone')}:</span>
                  <span className="font-mono font-semibold text-white text-right">+91 {formState.phoneNumber}</span>
                </div>

                <div className="flex justify-between items-center py-0.5 gap-2">
                  <span className="text-gray-400 shrink-0">{t('join.confirmationModal.barber')}:</span>
                  <span className="font-semibold text-[#D4A017] capitalize text-right">
                    {formState.barberPreference === 'any'
                      ? t('join.anyBarber')
                      : SALON_BARBERS.find((b) => b.id === formState.barberPreference)?.name}
                  </span>
                </div>

                <div className="flex justify-between items-start py-0.5 gap-2">
                  <span className="text-gray-400 shrink-0">{t('join.confirmationModal.services')}:</span>
                  <span className="font-semibold text-white text-right">
                    {selectedServices.map((s) => t(s.nameKey)).join(', ')}
                  </span>
                </div>

                <div className="flex justify-between items-center border-t border-[#374151]/70 pt-2 text-xs sm:text-sm font-bold">
                  <span className="text-gray-300">{t('join.confirmationModal.total')}:</span>
                  <span className="text-[#D4A017]">₹{totalPrice} ({totalDuration} mins)</span>
                </div>
              </div>
            </div>

            {/* Modal Actions - Always visible, never cut off */}
            <div className="flex gap-2 sm:gap-3 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowDemoConfirmation(false)}
                className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl border border-[#374151] text-xs font-bold text-gray-300 hover:bg-[#374151] transition-colors cursor-pointer flex items-center justify-center"
              >
                {t('join.confirmationModal.close')}
              </button>
              <button
                type="button"
                onClick={() => setShowDemoConfirmation(false)}
                className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-[#D4A017] text-[#111827] text-xs font-black hover:bg-[#B8860B] transition-colors cursor-pointer flex items-center justify-center"
              >
                {t('join.confirmationModal.dismiss')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
