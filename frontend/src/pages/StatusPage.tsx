import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../i18n/LanguageContext';
import { QueueTicketDetails, QueueStatus } from '../types/salon';
import { getSocket } from '../utils/socket';
import {
  ArrowLeft,
  Clock,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Bell,
  RefreshCw,
  Loader2,
  Info,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

export const StatusPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isExistingSpot = searchParams.get('existing') === 'true';
  const { t, language } = useTranslation();

  const [ticket, setTicket] = useState<QueueTicketDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Retrieve stored customer access token for this ticket
  const accessToken = useMemo(() => {
    if (!id) return '';
    return localStorage.getItem(`salon_access_token_${id}`) || '';
  }, [id]);

  // Fetch ticket details from authoritative backend
  const fetchTicket = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers['x-access-token'] = accessToken;
      }

      const res = await fetch(`/api/queue/${id}`, { headers });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load queue ticket');
      }

      setTicket(data.ticket);
    } catch (err: any) {
      setError(err.message || 'Error fetching ticket details');
    } finally {
      setLoading(false);
    }
  }, [id, accessToken]);

  // Initial load and Socket.IO real-time event listener
  useEffect(() => {
    fetchTicket();

    const socket = getSocket();

    const handleQueueUpdated = () => {
      fetchTicket();
    };

    socket.on('queue:updated', handleQueueUpdated);
    socket.on('connect', handleQueueUpdated);

    // Refresh when user returns to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTicket();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic safety fallback poll (every 10s)
    const interval = setInterval(() => {
      fetchTicket();
    }, 10000);

    return () => {
      socket.off('queue:updated', handleQueueUpdated);
      socket.off('connect', handleQueueUpdated);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [fetchTicket]);

  // Cancel Spot Handler
  const handleCancelSpot = async () => {
    if (!id || !accessToken) {
      setCancelError('Access credential missing. Cannot cancel.');
      return;
    }

    setIsCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/queue/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': accessToken
        }
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Cancellation failed');
      }

      setShowCancelModal(false);
      // Immediately reflect cancelled status
      setTicket((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
    } catch (err: any) {
      setCancelError(err.message || 'Could not cancel spot');
    } finally {
      setIsCancelling(false);
    }
  };


  // Helper for status badge styling
  const getStatusBadge = (status: QueueStatus) => {
    switch (status) {
      case 'waiting':
        return {
          bg: 'bg-amber-500/20 text-[#D4A017] border-amber-500/40',
          label: t('status.statusWaiting'),
          icon: <Clock className="w-3.5 h-3.5" />
        };
      case 'called':
        return {
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse',
          label: t('status.statusCalled'),
          icon: <Bell className="w-3.5 h-3.5 text-emerald-400" />
        };
      case 'in_chair':
        return {
          bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          label: t('status.statusInChair'),
          icon: <Scissors className="w-3.5 h-3.5 text-blue-400" />
        };
      case 'done':
        return {
          bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
          label: t('status.statusDone'),
          icon: <CheckCircle2 className="w-3.5 h-3.5" />
        };
      case 'cancelled':
        return {
          bg: 'bg-red-500/20 text-red-400 border-red-500/40',
          label: t('status.statusCancelled'),
          icon: <XCircle className="w-3.5 h-3.5" />
        };
      case 'no_show':
        return {
          bg: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
          label: t('status.statusNoShow'),
          icon: <AlertTriangle className="w-3.5 h-3.5" />
        };
      default:
        return {
          bg: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
          label: status,
          icon: null
        };
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <Loader2 className="w-10 h-10 text-[#D4A017] animate-spin mx-auto" />
        <p className="text-sm font-semibold text-gray-300">Loading your queue status...</p>
      </div>
    );
  }

  // Not found or error state
  if (error || !ticket) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center space-y-6">
        <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-6 sm:p-8 shadow-xl space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-white">{t('status.notFound')}</h2>
          <p className="text-xs sm:text-sm text-gray-400">{error || t('status.notFoundDesc')}</p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => {
                setLoading(true);
                fetchTicket();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#374151] hover:bg-[#4B5563] text-white text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
            <Link
              to="/"
              className="w-full py-2.5 px-4 rounded-xl bg-[#D4A017] hover:bg-[#B8860B] text-[#111827] text-xs font-black transition-colors"
            >
              {t('status.backToHome')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const badge = getStatusBadge(ticket.status);

  return (
    <div className="space-y-5 max-w-xl mx-auto pb-12 w-full min-w-0">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-300 hover:text-[#D4A017] transition-colors min-h-[38px] px-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('status.backToHome')}</span>
        </Link>
        <span className="text-xs font-mono text-gray-400">
          Token: <strong className="text-[#D4A017]">{ticket.tokenDisplay}</strong>
        </span>
      </div>

      {/* Existing Active Spot Info Notice */}
      {isExistingSpot && ticket.status === 'waiting' && (
        <div className="p-3.5 rounded-xl bg-[#D4A017]/15 border border-[#D4A017]/50 text-amber-200 text-xs flex items-start gap-2.5 shadow-md animate-in fade-in">
          <Info className="w-4 h-4 text-[#D4A017] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {t('join.existingSpotAlert')}
          </p>
        </div>
      )}

      {/* Primary Status Card */}
      <div className="bg-[#1F2937] border-2 border-[#374151] rounded-2xl p-5 sm:p-7 shadow-2xl space-y-6 text-center relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-[#D4A017]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Token Header */}
        <div className="space-y-2 relative">
          <span className="text-[11px] uppercase tracking-widest text-[#D4A017] font-black">
            {t('status.tokenLabel')}
          </span>
          <div className="text-5xl sm:text-6xl font-black text-white tracking-wider my-1 drop-shadow-sm">
            {ticket.tokenDisplay}
          </div>

          {/* Status Badge */}
          <div className="flex justify-center pt-1">
            <span
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold ${badge.bg}`}
            >
              {badge.icon}
              <span>{badge.label}</span>
            </span>
          </div>

          {/* Customer Info (Authorized) */}
          {ticket.customerName && (
            <p className="text-xs text-gray-300 pt-1 font-medium">
              {ticket.customerName} {ticket.phoneNumber && `(• • • • ${ticket.phoneNumber.slice(-4)})`}
            </p>
          )}
        </div>

        {/* CRITICAL ALERT 1: Second in line alert ("Start coming to the salon!") */}
        {ticket.status === 'waiting' && ticket.shouldStartComing && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/25 to-yellow-500/25 border-2 border-[#D4A017] text-white text-left flex items-start gap-3 shadow-lg shadow-[#D4A017]/15 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-[#D4A017] text-[#111827] flex items-center justify-center shrink-0 font-bold">
              🚶‍♂️
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-extrabold text-[#D4A017] uppercase tracking-wider">
                Salon Alert
              </p>
              <p className="text-sm font-bold text-white">
                {t('status.startComingBanner')}
              </p>
            </div>
          </div>
        )}

        {/* CRITICAL ALERT 2: Called alert ("It's your turn!") */}
        {ticket.status === 'called' && (
          <div className="p-4 rounded-xl bg-emerald-500/25 border-2 border-emerald-400 text-white text-left flex items-start gap-3 shadow-xl shadow-emerald-500/20 animate-bounce">
            <div className="w-8 h-8 rounded-lg bg-emerald-400 text-[#111827] flex items-center justify-center shrink-0 font-black">
              <Bell className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                Your Turn
              </p>
              <p className="text-sm sm:text-base font-extrabold text-white">
                {t('status.itsYourTurnBanner').replace(
                  '{barber}',
                  ticket.assignedBarber || (ticket.barberPreference !== 'any' ? ticket.barberPreference : 'the front desk')
                )}
              </p>
            </div>
          </div>
        )}

        {/* In Chair Notification */}
        {ticket.status === 'in_chair' && (
          <div className="p-4 rounded-xl bg-blue-500/20 border border-blue-400 text-blue-200 text-left flex items-start gap-3">
            <Scissors className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm">Service in progress</p>
              <p className="text-xs text-blue-300">
                You are currently in chair with {ticket.assignedBarber || 'your barber'}.
              </p>
            </div>
          </div>
        )}

        {/* Done Notification */}
        {ticket.status === 'done' && (
          <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500 text-emerald-200 text-left flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm">{t('status.statusDone')}</p>
              <p className="text-xs text-emerald-300">
                Thank you for visiting! Have a wonderful day.
              </p>
            </div>
          </div>
        )}

        {/* Cancelled Notification */}
        {ticket.status === 'cancelled' && (
          <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-left flex items-start gap-3">
            <XCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm">{t('status.statusCancelled')}</p>
              <p className="text-xs text-red-300">
                This queue ticket has been cancelled.
              </p>
            </div>
          </div>
        )}

        {/* Circular Progress Gauge */}
        <div className="py-2 flex flex-col items-center justify-center">
          <div className="relative w-44 h-44 flex items-center justify-center">
            {/* SVG Ring */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                className="stroke-[#374151]"
                strokeWidth="7"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                className={`transition-all duration-700 ease-out ${
                  ticket.status === 'called' || ticket.status === 'done'
                    ? 'stroke-emerald-400'
                    : ticket.status === 'cancelled'
                    ? 'stroke-red-400'
                    : 'stroke-[#D4A017]'
                }`}
                strokeWidth="7"
                strokeDasharray="264"
                strokeDashoffset={
                  ticket.status === 'called'
                    ? '0'
                    : ticket.status === 'waiting'
                    ? ticket.position === 1
                      ? '50'
                      : ticket.position === 2
                      ? '120'
                      : '180'
                    : '264'
                }
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 select-none">
              {ticket.status === 'waiting' ? (
                ticket.isWaitUnavailable ? (
                  <div className="space-y-1">
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                      Estimate
                    </span>
                    <p className="text-xs font-bold text-gray-300 leading-tight">
                      {t('status.waitUnavailable')}
                    </p>
                    <p className="text-[9px] text-gray-500">
                      {ticket.waitReasonCode ? t(`settings.${ticket.waitReasonCode}`) : t('status.waitUnavailable')}
                    </p>
                  </div>
                ) : (
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                      {t('status.approxWait')}
                    </span>
                    <p className="text-2xl sm:text-3xl font-black text-[#D4A017]">
                      ~{ticket.approxWaitMinutes}
                    </p>
                    <span className="text-[11px] text-gray-400 font-medium">mins</span>
                  </div>
                )
              ) : ticket.status === 'called' ? (
                <div className="space-y-1 animate-pulse">
                  <Bell className="w-6 h-6 text-emerald-400 mx-auto" />
                  <p className="text-sm font-black text-emerald-300">Your Turn!</p>
                </div>
              ) : ticket.status === 'in_chair' ? (
                <div className="space-y-1">
                  <Scissors className="w-6 h-6 text-blue-400 mx-auto" />
                  <p className="text-sm font-black text-blue-300">In Chair</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                  <p className="text-sm font-black text-white">{badge.label}</p>
                </div>
              )}
            </div>
          </div>

          {ticket.status === 'waiting' && !ticket.isWaitUnavailable && (
            <p className="text-[10px] text-gray-500 mt-2">
              {t('status.waitNote')}
            </p>
          )}
        </div>

        {/* Live Queue Cards */}
        <div className="grid grid-cols-2 gap-3 text-left">
          {/* Queue Position */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#111827] border border-[#374151]">
            <span className="text-xs text-gray-400 block font-medium">
              {t('status.position')}
            </span>
            <p className="text-lg sm:text-xl font-bold text-white mt-0.5 truncate">
              {ticket.status === 'waiting'
                ? ticket.position === 1
                  ? t('status.nextInLine')
                  : `${ticket.position} ${t('status.positionLabel')}`
                : '-'}
            </p>
          </div>

          {/* Barber Preference */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#111827] border border-[#374151]">
            <span className="text-xs text-gray-400 block font-medium">
              {ticket.assignedBarber ? t('status.assignedBarber') : t('status.barber')}
            </span>
            <p className="text-lg sm:text-xl font-bold text-[#D4A017] mt-0.5 truncate capitalize">
              {ticket.assignedBarber
                ? ticket.assignedBarber
                : ticket.barberPreference === 'any'
                ? t('join.anyBarber')
                : ticket.barberPreference}
            </p>
          </div>
        </div>

        {/* Status Pipeline Step Indicator */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-[#111827] border border-[#374151] space-y-3">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold">
            <span
              className={
                ticket.status === 'waiting'
                  ? 'text-[#D4A017] font-bold'
                  : ['called', 'in_chair', 'done'].includes(ticket.status)
                  ? 'text-emerald-400'
                  : 'text-gray-500'
              }
            >
              1. Waiting
            </span>
            <span
              className={
                ticket.status === 'called'
                  ? 'text-emerald-400 font-bold animate-pulse'
                  : ['in_chair', 'done'].includes(ticket.status)
                  ? 'text-emerald-400'
                  : 'text-gray-500'
              }
            >
              2. Called
            </span>
            <span
              className={
                ticket.status === 'in_chair'
                  ? 'text-blue-400 font-bold'
                  : ticket.status === 'done'
                  ? 'text-emerald-400'
                  : 'text-gray-500'
              }
            >
              3. In Chair
            </span>
            <span
              className={
                ticket.status === 'done' ? 'text-emerald-400 font-bold' : 'text-gray-500'
              }
            >
              4. Done
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-[#374151] overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                ticket.status === 'waiting'
                  ? 'w-1/4 bg-[#D4A017]'
                  : ticket.status === 'called'
                  ? 'w-2/4 bg-emerald-400 animate-pulse'
                  : ticket.status === 'in_chair'
                  ? 'w-3/4 bg-blue-400'
                  : ticket.status === 'done'
                  ? 'w-full bg-emerald-500'
                  : 'w-0'
              }`}
            />
          </div>
        </div>

        {/* Selected Services Summary */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-[#111827] border border-[#374151] text-left space-y-2.5">
          <p className="text-xs font-bold text-gray-300 uppercase tracking-wider border-b border-[#374151] pb-1.5 flex items-center justify-between">
            <span>{t('status.services')}</span>
            <span className="text-[#D4A017]">{ticket.services.length}</span>
          </p>

          <div className="space-y-1.5 text-xs">
            {ticket.services.map((s) => (
              <div key={s.id} className="flex justify-between items-center text-gray-300">
                <span className="truncate pr-2">{language === 'gu' ? s.name_gu : s.name_en}</span>
                <span className="text-[#D4A017] font-semibold shrink-0">₹{s.price}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-[#374151]/80 pt-2 flex justify-between items-center text-xs sm:text-sm font-extrabold">
            <span className="text-gray-300">
              {t('status.total')} ({ticket.totalDurationMinutes} {t('home.minutes')})
            </span>
            <span className="text-[#D4A017] text-base">₹{ticket.totalPrice}</span>
          </div>
        </div>

        {/* Cancel Spot Button (Only active when in waiting status AND customer is authorized) */}
        {ticket.status === 'waiting' && ticket.isAuthorized && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-red-500/40 text-red-400 hover:text-white hover:bg-red-500/20 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              <span>{t('status.cancelButton')}</span>
            </button>
          </div>
        )}

        {/* Live tracking message for unauthorized visitors viewing duplicate spot */}
        {ticket.status === 'waiting' && !ticket.isAuthorized && (
          <div className="pt-1">
            <div className="p-3 rounded-xl bg-[#111827] border border-[#374151] text-center text-xs text-gray-400">
              <span className="text-[#D4A017] font-semibold">Live Tracking Mode</span> — Cancellation is only permitted from the original device that booked this spot.
            </div>
          </div>
        )}

        {/* Quick action to join another spot if completed or cancelled */}
        {['done', 'cancelled', 'no_show'].includes(ticket.status) && (
          <div className="pt-1">
            <Link
              to="/join"
              className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#B8860B] hover:brightness-110 text-[#111827] text-xs font-black transition-all flex items-center justify-center gap-2"
            >
              <span>{t('status.joinNewSpot')}</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Cancel Spot Confirmation Modal */}
      {showCancelModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm overflow-y-auto p-3 sm:p-4 flex min-h-full items-center justify-center animate-in fade-in"
        >
          <div className="bg-[#1F2937] border-2 border-red-500/60 rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl relative my-auto">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base sm:text-lg font-black text-white">
                {t('status.cancelModalTitle')}
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                {t('status.cancelModalDesc')}
              </p>
            </div>

            {cancelError && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500 text-red-300 text-xs">
                {cancelError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="min-h-[44px] py-2.5 px-3 rounded-xl border border-[#374151] text-xs font-bold text-gray-300 hover:bg-[#374151] transition-colors cursor-pointer"
              >
                {t('status.keepSpot')}
              </button>
              <button
                type="button"
                onClick={handleCancelSpot}
                disabled={isCancelling}
                className="min-h-[44px] py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('status.cancelling')}</span>
                  </>
                ) : (
                  <span>{t('status.confirmCancel')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
