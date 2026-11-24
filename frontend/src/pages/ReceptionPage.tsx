/**
 * ReceptionPage.tsx — Step 4: Full Reception Dashboard
 *
 * Connects to the existing /api/reception/* backend routes.
 * Uses secure staff session tokens (stored in sessionStorage, never raw PIN).
 * Subscribes to Socket.IO "queue:updated" events for live updates.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { subscribeToQueue } from '../utils/liveQueue';
import { getSocket } from '../utils/socket';
import {
  Lock,
  LogOut,
  PlusCircle,
  Scissors,
  Clock,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle,
  Globe,
  RefreshCw,
  Coffee,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import type { ReceptionDashboardData, ReceptionBarberOverview, ReceptionQueueItem } from '../types/salon';

// ─── Constants ──────────────────────────────────────────────────────────────
const API_BASE = '/api';
const SESSION_KEY = 'salon_staff_token';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getStoredToken(): string | null {
  try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; }
}
function storeToken(token: string): void {
  try { sessionStorage.setItem(SESSION_KEY, token); } catch {}
}
function clearToken(): void {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
}

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function fmtElapsed(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function graceCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'waiting':   return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'called':    return 'bg-[#D4A017]/20 text-[#D4A017] border-[#D4A017]/40';
    case 'in_chair':  return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    case 'done':      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'no_show':   return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    default:          return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

function barberStateColor(state: string): string {
  switch (state) {
    case 'available': return 'bg-emerald-500/20 text-emerald-400';
    case 'busy':
    case 'calling':   return 'bg-[#D4A017]/20 text-[#D4A017]';
    case 'in_chair':  return 'bg-purple-500/20 text-purple-400';
    case 'break':     return 'bg-orange-500/20 text-orange-400';
    case 'off_duty':  return 'bg-gray-500/20 text-gray-500';
    default:          return 'bg-gray-500/20 text-gray-500';
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Single barber card shown in the top section */
function BarberCard({
  barber,
  onCallNext,
  callingId,
  t,
}: {
  barber: ReceptionBarberOverview;
  onCallNext: (barberId: string) => void;
  callingId: string | null;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const canCall = barber.dutyStatus === 'on_duty' && barber.operationalState === 'available';
  const isCalling = callingId === barber.id;

  return (
    <div className="bg-[#111827] border border-[#374151] rounded-2xl p-4 flex flex-col gap-3">
      {/* Barber name + state */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#D4A017]/20 text-[#D4A017] flex items-center justify-center font-bold text-sm">
            {barber.name[0]}
          </div>
          <span className="font-semibold text-sm text-white">{barber.name}</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${barberStateColor(barber.operationalState)}`}>
          {barber.operationalState === 'available' && t('reception.free')}
          {barber.operationalState === 'busy'      && t('reception.busy')}
          {barber.operationalState === 'calling'   && t('reception.busyCalling')}
          {barber.operationalState === 'in_chair'  && t('reception.busyInChair')}
          {barber.operationalState === 'break'     && t('reception.onBreak')}
          {barber.operationalState === 'off_duty'  && t('reception.offDuty')}
        </span>
      </div>

      {/* Current ticket */}
      {barber.currentTicket ? (
        <div className="text-xs text-gray-300 bg-[#1F2937] rounded-lg px-3 py-2 space-y-0.5">
          <div className="flex justify-between">
            <span className="text-[#D4A017] font-bold">{barber.currentTicket.tokenDisplay}</span>
            <span className="text-gray-400">{fmtElapsed(barber.currentTicket.elapsedMinutes)}</span>
          </div>
          <p className="text-gray-500 truncate">{barber.currentTicket.customerName}</p>
        </div>
      ) : (
        <p className="text-xs text-gray-500 italic">{t('reception.emptyQueue')}</p>
      )}

      {/* Call Next button */}
      <button
        disabled={!canCall || isCalling}
        onClick={() => onCallNext(barber.id)}
        className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
          canCall && !isCalling
            ? 'bg-gradient-to-r from-[#D4A017] to-[#B8860B] text-[#111827] hover:opacity-90 cursor-pointer'
            : 'bg-[#374151] text-gray-500 cursor-not-allowed'
        }`}
      >
        {isCalling ? (
          <><RefreshCw className="w-3 h-3 animate-spin" />{t('reception.callingBtn')}</>
        ) : (
          <><ChevronRight className="w-3 h-3" />{t('reception.callNextBtn')}</>
        )}
      </button>
    </div>
  );
}

/** Status label for a queue row */
function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const labels: Record<string, string> = {
    waiting:   t('status.statusWaiting'),
    called:    t('status.statusCalled'),
    in_chair:  t('status.statusInChair'),
    done:      t('status.statusDone'),
    cancelled: t('status.statusCancelled'),
    no_show:   t('status.statusNoShow'),
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusColor(status)}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ─── Walk-in Modal ────────────────────────────────────────────────────────────
interface WalkInModalProps {
  token: string;
  services: Array<{ id: string; name_en: string; name_gu: string; duration_minutes: number; price: number }>;
  barbers: ReceptionBarberOverview[];
  onClose: () => void;
  onSuccess: () => void;
  t: (key: string) => string;
  language: string;
}

function WalkInModal({ token, services, barbers, onClose, onSuccess, t, language }: WalkInModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [barberPref, setBarberPref] = useState('any');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const handleSubmit = async () => {
    setError('');
    const cleanPhone = phone.replace(/\D/g, '');
    if (!name.trim() || name.trim().length < 2) { setError('Customer name must be at least 2 characters.'); return; }
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) { setError('Invalid phone. Must be a 10-digit Indian mobile number.'); return; }
    if (selectedServices.length === 0) { setError('Please select at least 1 service.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/reception/walk-in`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ customerName: name.trim(), phoneNumber: cleanPhone, serviceIds: selectedServices, barberPreference: barberPref }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to register walk-in'); setSubmitting(false); return; }
      onSuccess();
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#1F2937] border border-[#374151] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#1F2937] border-b border-[#374151] px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="font-bold text-white text-base">{t('reception.walkInModalTitle')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t('reception.walkInModalDesc')}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 cursor-pointer"><XCircle className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">{t('join.nameLabel')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('join.namePlaceholder')}
              className="w-full bg-[#111827] border border-[#374151] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D4A017]"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">{t('join.phoneLabel')}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder={t('join.phonePlaceholder')}
              className="w-full bg-[#111827] border border-[#374151] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D4A017]"
            />
          </div>

          {/* Services */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">
              {t('join.selectServices')} ({selectedServices.length}/3)
            </label>
            <div className="grid grid-cols-1 gap-2">
              {services.map((svc) => {
                const selected = selectedServices.includes(svc.id);
                const disabled = !selected && selectedServices.length >= 3;
                const displayName = language === 'gu' ? svc.name_gu : svc.name_en;
                return (
                  <button
                    key={svc.id}
                    onClick={() => !disabled && toggleService(svc.id)}
                    disabled={disabled}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                      selected
                        ? 'border-[#D4A017] bg-[#D4A017]/10 text-white'
                        : disabled
                        ? 'border-[#374151] bg-[#111827] text-gray-600 cursor-not-allowed'
                        : 'border-[#374151] bg-[#111827] text-gray-300 hover:border-[#D4A017]/50'
                    }`}
                  >
                    <span>{displayName}</span>
                    <span className="text-gray-400">{svc.duration_minutes}min · ₹{svc.price}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Barber preference */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">{t('join.selectBarber')}</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ id: 'any', name: t('join.anyBarber') }, ...barbers.filter(b => b.dutyStatus === 'on_duty').map(b => ({ id: b.id, name: b.name }))].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setBarberPref(opt.id)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    barberPref === opt.id
                      ? 'border-[#D4A017] bg-[#D4A017]/10 text-[#D4A017]'
                      : 'border-[#374151] bg-[#111827] text-gray-300 hover:border-[#D4A017]/40'
                  }`}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#B8860B] text-[#111827] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><RefreshCw className="w-4 h-4 animate-spin" />{t('reception.walkInSubmitting')}</>
            ) : (
              <><PlusCircle className="w-4 h-4" />{t('reception.walkInSubmitBtn')}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cancel Confirm Modal ─────────────────────────────────────────────────────
function CancelModal({
  token,
  ticketId,
  staffToken,
  onClose,
  onSuccess,
  t,
}: {
  token: string;
  ticketId: string;
  staffToken: string;
  onClose: () => void;
  onSuccess: () => void;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reception/cancel/${ticketId}`, {
        method: 'POST',
        headers: authHeaders(staffToken),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to cancel'); setLoading(false); return; }
      onSuccess();
    } catch {
      setError('Network error');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#1F2937] border border-[#374151] rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
          <h2 className="font-bold text-white">{t('reception.cancelModalTitle')}</h2>
        </div>
        <p className="text-sm text-gray-300">{t('reception.cancelModalDesc', { token })}</p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#374151] text-sm text-gray-300 hover:text-white cursor-pointer">
            {t('reception.cancelKeepBtn')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold cursor-pointer disabled:opacity-60"
          >
            {loading ? '...' : t('reception.cancelConfirmBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── No-Show Confirm Modal ────────────────────────────────────────────────────
function NoShowModal({
  token,
  ticketId,
  staffToken,
  onClose,
  onSuccess,
  t,
}: {
  token: string;
  ticketId: string;
  staffToken: string;
  onClose: () => void;
  onSuccess: () => void;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reception/no-show/${ticketId}`, {
        method: 'POST',
        headers: authHeaders(staffToken),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to mark no-show'); setLoading(false); return; }
      onSuccess();
    } catch {
      setError('Network error');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#1F2937] border border-[#374151] rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <UserX className="w-6 h-6 text-orange-400 flex-shrink-0" />
          <h2 className="font-bold text-white">{t('reception.noShowModalTitle')}</h2>
        </div>
        <p className="text-sm text-gray-300">{t('reception.noShowModalDesc', { token })}</p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#374151] text-sm text-gray-300 hover:text-white cursor-pointer">
            {t('reception.cancelKeepBtn')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold cursor-pointer disabled:opacity-60"
          >
            {loading ? '...' : t('reception.noShowConfirmBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Queue Row ────────────────────────────────────────────────────────────────
function QueueRow({
  item,
  onCancel,
  onNoShow,
  t,
  language,
}: {
  item: ReceptionQueueItem;
  onCancel: (ticketId: string, token: string) => void;
  onNoShow: (ticketId: string, token: string) => void;
  t: (k: string, vars?: Record<string, string>) => string;
  language: string;
}) {
  return (
    <div className={`bg-[#111827] border rounded-xl p-3 sm:p-4 space-y-2 ${
      item.isOver60MinWait ? 'border-amber-500/40' : 'border-[#374151]'
    }`}>
      {/* Row top: token + badges + status */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-black text-[#D4A017] tracking-wider">{item.tokenDisplay}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
          item.isWalkIn
            ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
            : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
        }`}>
          {item.isWalkIn ? t('reception.walkInBadge') : t('reception.onlineBadge')}
        </span>
        <StatusBadge status={item.status} t={t} />
        {item.isOver60MinWait && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold">
            {t('reception.over60MinNotice')}
          </span>
        )}
      </div>

      {/* Customer + barber preference */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-300">
        <span className="font-semibold text-white">{item.customerName}</span>
        <span className="text-gray-500">
          {t('reception.colBarber')}: {item.assignedBarber ?? item.barberPreference}
        </span>
        {item.approxWaitMinutes !== null && item.status === 'waiting' && (
          <span className="text-gray-400">
            <Clock className="w-3 h-3 inline mr-0.5" />
            ~{item.approxWaitMinutes} min
          </span>
        )}
        {item.isWaitUnavailable && item.status === 'waiting' && (
          <span className="text-gray-500 italic">{t('status.waitUnavailable')}</span>
        )}
      </div>

      {/* Services list */}
      <div className="flex flex-wrap gap-1">
        {item.services.map((svc) => (
          <span key={svc.id} className="text-[10px] px-2 py-0.5 rounded bg-[#1F2937] text-gray-400 border border-[#374151]">
            {language === 'gu' ? svc.name_gu : svc.name_en} · {svc.duration_minutes}min
          </span>
        ))}
        <span className="text-[10px] px-2 py-0.5 rounded bg-[#1F2937] text-[#D4A017] border border-[#D4A017]/30 font-semibold">
          ₹{item.totalPrice}
        </span>
      </div>

      {/* Grace period / no-show info (for called status) */}
      {item.status === 'called' && item.graceRemainingSeconds !== null && item.graceRemainingSeconds > 0 && (
        <p className="text-[10px] text-orange-400">
          <Clock className="w-3 h-3 inline mr-0.5" />
          {t('reception.graceRemaining')}: {graceCountdown(item.graceRemainingSeconds)}
        </p>
      )}
      {item.status === 'called' && item.graceRemainingSeconds === 0 && (
        <p className="text-[10px] text-red-400 font-semibold">
          {t('reception.graceExpired')}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        {item.status === 'waiting' && (
          <button
            onClick={() => onCancel(item.id, item.tokenDisplay)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 text-xs hover:bg-red-500/10 cursor-pointer transition-all"
          >
            <XCircle className="w-3.5 h-3.5" />{t('reception.cancelBtn')}
          </button>
        )}
        {item.status === 'called' && item.canMarkNoShow && (
          <button
            onClick={() => onNoShow(item.id, item.tokenDisplay)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-orange-500/40 text-orange-400 text-xs hover:bg-orange-500/10 cursor-pointer transition-all"
          >
            <UserX className="w-3.5 h-3.5" />{t('reception.noShowBtn')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export const ReceptionPage: React.FC = () => {
  const { t, language, toggleLanguage } = useTranslation();

  // Auth state
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false); // true once we know if logged in or not
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Dashboard data
  const [data, setData] = useState<ReceptionDashboardData | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [loading, setLoading] = useState(false);

  // Live service catalog for the walk-in modal
  const [availableServices, setAvailableServices] = useState<Array<{
    id: string; name_en: string; name_gu: string; duration_minutes: number; price: number;
  }>>([]);

  // UI state
  const [filterTab, setFilterTab] = useState<'all' | 'waiting' | 'called' | 'in_chair' | 'history'>('all');
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [callingBarberId, setCallingBarberId] = useState<string | null>(null);
  const [callFeedback, setCallFeedback] = useState<{ barberId: string; msg: string; ok: boolean } | null>(null);

  // Modal state
  const [cancelTarget, setCancelTarget] = useState<{ id: string; token: string } | null>(null);
  const [noShowTarget, setNoShowTarget] = useState<{ id: string; token: string } | null>(null);

  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── On mount: check stored session ──────────────────────────────────────────
  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) { setAuthChecked(true); return; }

    fetch(`${API_BASE}/reception/session`, { headers: authHeaders(stored) })
      .then((res) => {
        if (res.ok) { setStaffToken(stored); }
        else { clearToken(); }
      })
      .catch(() => { clearToken(); })
      .finally(() => setAuthChecked(true));
  }, []);

  // ── Fetch dashboard data ─────────────────────────────────────────────────────
  const fetchDashboard = useCallback(async (token: string, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const [res, servicesResponse] = await Promise.all([
        fetch(`${API_BASE}/reception/dashboard`, { headers: authHeaders(token), signal }),
        fetch(`${API_BASE}/salon/services`, { signal, cache: 'no-store' }),
      ]);
      if (signal?.aborted) return;
      if (res.status === 401) { clearToken(); setStaffToken(null); return; }
      const json = await res.json();
      if (!json.success || !servicesResponse.ok) {
        setFetchError('settings.loadFailed');
        return;
      }
      const serviceData = await servicesResponse.json();
      if (signal?.aborted) return;
      setData(json.data);
      setAvailableServices(serviceData.services);
      setFetchError('');
      return json.data.refreshAfterMs as number;
    } catch {
      if (!signal?.aborted) setFetchError('settings.loadFailed');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Auto-fetch when logged in and on socket updates ─────────────────────────
  useEffect(() => {
    if (!staffToken) return;
    const live = subscribeToQueue(getSocket(), (signal) => fetchDashboard(staffToken, signal), () => {});
    return () => live.stop();
  }, [staffToken, fetchDashboard]);

  // ── Grace countdown live timer (re-renders every second when called tickets exist) ──
  useEffect(() => {
    if (!data) return;
    const hasCalled = data.queue.some((q) => q.status === 'called' && q.graceRemainingSeconds !== null && q.graceRemainingSeconds > 0);
    if (!hasCalled || !staffToken) return;

    const interval = setInterval(() => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          queue: prev.queue.map((q) => {
            if (q.status !== 'called' || q.graceRemainingSeconds === null || q.graceRemainingSeconds <= 0) return q;
            const newSecs = Math.max(0, q.graceRemainingSeconds - 1);
            return { ...q, graceRemainingSeconds: newSecs, canMarkNoShow: newSecs === 0 };
          }),
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [data, staffToken]);

  // ── Login ────────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!pin.trim()) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/reception/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || 'Login failed'); setLoginLoading(false); return; }
      storeToken(data.token);
      setStaffToken(data.token);
      setPin('');
    } catch {
      setLoginError('Network error. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Logout ───────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    if (!staffToken) return;
    try {
      await fetch(`${API_BASE}/reception/logout`, { method: 'POST', headers: authHeaders(staffToken) });
    } catch {}
    clearToken();
    setStaffToken(null);
    setData(null);
  };

  // ── Call Next ─────────────────────────────────────────────────────────────────
  const handleCallNext = async (barberId: string) => {
    if (!staffToken) return;
    setCallingBarberId(barberId);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

    try {
      const res = await fetch(`${API_BASE}/reception/call-next`, {
        method: 'POST',
        headers: authHeaders(staffToken),
        body: JSON.stringify({ barberId }),
      });
      const json = await res.json();
      const barberName = data?.barbers.find((b) => b.id === barberId)?.name ?? barberId;
      if (!res.ok || !json.called) {
        const msg = json.error || json.message || t('reception.noEligible').replace('{barber}', barberName);
        setCallFeedback({ barberId, msg, ok: false });
      } else {
        setCallFeedback({ barberId, msg: json.message ?? 'Called!', ok: true });
        await fetchDashboard(staffToken);
      }
    } catch {
      setCallFeedback({ barberId, msg: 'Network error', ok: false });
    } finally {
      setCallingBarberId(null);
      feedbackTimerRef.current = setTimeout(() => setCallFeedback(null), 4000);
    }
  };

  // ── Filtered queue list ───────────────────────────────────────────────────────
  const filteredQueue = (() => {
    if (!data) return [];
    switch (filterTab) {
      case 'waiting':  return data.queue.filter((q) => q.status === 'waiting');
      case 'called':   return data.queue.filter((q) => q.status === 'called');
      case 'in_chair': return data.queue.filter((q) => q.status === 'in_chair');
      case 'history':  return data.queue.filter((q) => ['done', 'cancelled', 'no_show'].includes(q.status));
      default:         return data.queue;
    }
  })();

  // ── Loading / auth guard ──────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-6 h-6 animate-spin text-[#D4A017]" />
      </div>
    );
  }

  // ── PIN Login Screen ──────────────────────────────────────────────────────────
  if (!staffToken) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-8 w-full max-w-sm shadow-2xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#D4A017]/20 text-[#D4A017] flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{t('reception.pinTitle')}</h1>
              <p className="text-xs text-gray-400">{t('reception.pinDesc')}</p>
            </div>
          </div>

          {loginError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{loginError}
            </div>
          )}

          <div className="space-y-3">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder={t('reception.pinPlaceholder')}
              className="w-full bg-[#111827] border border-[#374151] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#D4A017] tracking-widest"
              autoComplete="current-password"
            />
            <button
              onClick={handleLogin}
              disabled={loginLoading || !pin.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#B8860B] text-[#111827] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loginLoading ? (
                <><RefreshCw className="w-4 h-4 animate-spin" />{t('reception.pinLoggingIn')}</>
              ) : (
                <><UserCheck className="w-4 h-4" />{t('reception.pinSubmit')}</>
              )}
            </button>
          </div>

          {/* Language toggle on login screen */}
          <div className="flex justify-center pt-1">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#D4A017] transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />{t('languageLabel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated Dashboard ──────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-4 sm:px-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title + salon status */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#D4A017]/20 text-[#D4A017] flex items-center justify-center flex-shrink-0">
              <Scissors className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-white truncate">{t('reception.title')}</h1>
              <span className={`text-[10px] font-semibold ${data?.salonOpen ? 'text-emerald-400' : 'text-red-400'}`}>
                {data?.salonOpen ? t('reception.salonOpen') : t('reception.salonClosed')}
              </span>
            </div>
          </div>

          {/* Stat chips */}
          {data && (
            <div className="flex flex-wrap gap-2">
              {[
                { label: t('reception.totalWaiting'), value: data.stats.waitingCount, color: 'text-blue-400' },
                { label: t('reception.totalCalled'),  value: data.stats.calledCount,  color: 'text-[#D4A017]' },
                { label: t('reception.totalInChair'), value: data.stats.inChairCount, color: 'text-emerald-400' },
                { label: t('reception.totalCompleted'), value: data.stats.completedCount, color: 'text-gray-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex flex-col items-center px-3 py-1 rounded-lg bg-[#111827] border border-[#374151]">
                  <span className={`text-lg font-black ${color}`}>{value}</span>
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#374151] text-xs text-gray-300 hover:text-[#D4A017] cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />{t('languageLabel')}
            </button>
            <button
              disabled={!data?.salonOpen}
              onClick={() => setShowWalkIn(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4A017] text-[#111827] text-xs font-bold hover:opacity-90 cursor-pointer disabled:opacity-50"
            >
              <PlusCircle className="w-3.5 h-3.5" />{t('reception.addWalkIn')}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#374151] text-xs text-gray-300 hover:text-red-400 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />{t('reception.logout')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Global error ── */}
      {fetchError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{t(fetchError)}
        </div>
      )}

      {/* ── Call-next feedback ── */}
      {callFeedback && (
        <div className={`flex items-center gap-2 p-3 rounded-xl border text-xs ${
          callFeedback.ok
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-orange-500/10 border-orange-500/30 text-orange-400'
        }`}>
          {callFeedback.ok
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0" />
          }
          {callFeedback.msg}
        </div>
      )}

      {/* ── Barber Cards ── */}
      <div>
        <h2 className="text-xs font-bold text-[#D4A017] uppercase tracking-wider mb-3">
          {t('reception.barbersSection')}
        </h2>
        {data ? (
          <div className="grid sm:grid-cols-3 gap-3">
            {data.barbers.map((b) => (
              <BarberCard
                key={b.id}
                barber={b}
                onCallNext={handleCallNext}
                callingId={callingBarberId}
                t={t}
              />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            {['Ravi', 'Amit', 'Imran'].map((name) => (
              <div key={name} className="bg-[#111827] border border-[#374151] rounded-2xl p-4 animate-pulse h-28" />
            ))}
          </div>
        )}
      </div>

      {/* ── Queue List ── */}
      <div className="bg-[#1F2937] border border-[#374151] rounded-2xl shadow-xl overflow-hidden">
        {/* Filter tabs */}
        <div className="flex overflow-x-auto border-b border-[#374151] px-2 pt-2 gap-1 scrollbar-hide">
          {(
            [
              { key: 'all',      label: t('reception.filterAll') },
              { key: 'waiting',  label: t('reception.filterWaiting') },
              { key: 'called',   label: t('reception.filterCalled') },
              { key: 'in_chair', label: t('reception.filterInChair') },
              { key: 'history',  label: t('reception.filterHistory') },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterTab(key)}
              className={`px-4 py-2 rounded-t-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filterTab === key
                  ? 'bg-[#111827] text-[#D4A017] border-t border-l border-r border-[#374151]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {label}
              {key !== 'history' && data && (
                <span className="ml-1.5 text-[9px] opacity-60">
                  ({key === 'all' ? data.queue.length :
                    key === 'waiting' ? data.stats.waitingCount :
                    key === 'called'  ? data.stats.calledCount :
                    data.stats.inChairCount})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Queue items */}
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {loading && !data ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-[#D4A017]" />
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Coffee className="w-10 h-10 text-gray-600" />
              <p className="text-sm text-gray-500">{t('reception.emptyQueue')}</p>
            </div>
          ) : (
            filteredQueue.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                onCancel={(id, tok) => setCancelTarget({ id, token: tok })}
                onNoShow={(id, tok) => setNoShowTarget({ id, token: tok })}
                t={t}
                language={language}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Walk-in Modal ── */}
      {showWalkIn && (
        <WalkInModal
          token={staffToken}
          services={availableServices}
          barbers={data?.barbers ?? []}
          onClose={() => setShowWalkIn(false)}
          onSuccess={() => { setShowWalkIn(false); if (staffToken) fetchDashboard(staffToken); }}
          t={t}
          language={language}
        />
      )}

      {/* ── Cancel Modal ── */}
      {cancelTarget && (
        <CancelModal
          token={cancelTarget.token}
          ticketId={cancelTarget.id}
          staffToken={staffToken}
          onClose={() => setCancelTarget(null)}
          onSuccess={() => { setCancelTarget(null); if (staffToken) fetchDashboard(staffToken); }}
          t={t}
        />
      )}

      {/* ── No-Show Modal ── */}
      {noShowTarget && (
        <NoShowModal
          token={noShowTarget.token}
          ticketId={noShowTarget.id}
          staffToken={staffToken}
          onClose={() => setNoShowTarget(null)}
          onSuccess={() => { setNoShowTarget(null); if (staffToken) fetchDashboard(staffToken); }}
          t={t}
        />
      )}
    </div>
  );
};
