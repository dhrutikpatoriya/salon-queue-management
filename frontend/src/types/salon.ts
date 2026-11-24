export interface SalonService {
  id: string;
  nameKey: string;
  defaultName: string;
  category: 'hair' | 'beard' | 'spa' | 'color';
  durationMinutes: number;
  price: number;
  descriptionKey: string;
  defaultDescription: string;
}

export type BarberStatus = 'available' | 'busy' | 'break';

export interface Barber {
  id: string;
  name: string;
  status: BarberStatus;
  specializationKey: string;
  defaultSpecialization: string;
  activeToken?: string;
}

export interface JoinQueueFormState {
  customerName: string;
  phoneNumber: string;
  selectedServiceIds: string[];
  barberPreference: string; // 'any' or barber id
}

export interface JoinQueueValidationErrors {
  customerName?: string;
  phoneNumber?: string;
  services?: string;
  barberPreference?: string;
}

export type QueueStatus = 'waiting' | 'called' | 'in_chair' | 'done' | 'cancelled' | 'no_show';

export interface QueueServiceItem {
  id: string;
  name_en: string;
  name_gu: string;
  duration_minutes: number;
  price: number;
  category: string;
}

export interface QueueTicketDetails {
  id: string;
  tokenNumber: number;
  tokenDisplay: string;
  status: QueueStatus;
  barberPreference: string;
  assignedBarber: string | null;
  totalDurationMinutes: number;
  totalPrice: number;
  services: QueueServiceItem[];
  position: number;
  approxWaitMinutes: number | null;
  isWaitUnavailable: boolean;
  waitReason?: string;
  waitReasonCode?: 'noneWorking' | 'preferredOffDuty' | 'preferredOnBreak';
  shouldStartComing: boolean;
  isYourTurn: boolean;
  createdAt: string;
  calledAt: string | null;
  customerName?: string;
  phoneNumber?: string;
  isAuthorized: boolean;
}

export interface ReceptionBarberOverview {
  id: string;
  name: string;
  dutyStatus: 'on_duty' | 'off_duty';
  operationalState: 'available' | 'busy' | 'calling' | 'in_chair' | 'break' | 'off_duty';
  currentTicket: {
    id: string;
    tokenDisplay: string;
    customerName: string;
    status: 'called' | 'in_chair';
    calledAt: string | null;
    startedAt: string | null;
    elapsedMinutes: number;
  } | null;
}

export interface ReceptionQueueItem {
  id: string;
  tokenNumber: number;
  tokenDisplay: string;
  customerName: string;
  phoneNumber: string;
  isWalkIn: boolean;
  barberPreference: string;
  assignedBarber: string | null;
  status: QueueStatus;
  totalDurationMinutes: number;
  totalPrice: number;
  services: QueueServiceItem[];
  position: number;
  approxWaitMinutes: number | null;
  isWaitUnavailable: boolean;
  isOver60MinWait: boolean;
  createdAt: string;
  calledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  graceRemainingSeconds: number | null;
  canMarkNoShow: boolean;
}

export interface ReceptionDashboardData {
  salonOpen: boolean;
  salonMessage?: string;
  refreshAfterMs: number;
  todayDate: string;
  barbers: ReceptionBarberOverview[];
  queue: ReceptionQueueItem[];
  stats: {
    totalToday: number;
    waitingCount: number;
    calledCount: number;
    inChairCount: number;
    completedCount: number;
    noShowCount: number;
    cancelledCount: number;
  };
}

export type BarberAvailability = 'available' | 'busy' | 'break' | 'off_duty';

export interface BarberDashboard {
  name: string;
  status: BarberAvailability;
  canToggleAvailability: boolean;
  nextToken: string | null;
  assignment: {
    id: string;
    token: string;
    customerName: string;
    status: 'called' | 'in_chair';
    durationMinutes: number;
    startedAt: string | null;
    services: Array<{ nameEn: string; nameGu: string; durationMinutes: number }>;
  } | null;
}

export interface DisplaySnapshot {
  date: string;
  salonOpen: boolean;
  barbers: Array<{
    name: string;
    status: BarberAvailability | 'called' | 'in_chair';
    token: string | null;
  }>;
  waiting: Array<{ token: string; approxWaitMinutes: number | null }>;
}

export type ServiceCategory = 'hair' | 'beard' | 'spa' | 'color';
export type SalonClosure = 'beforeOpening' | 'afterClosing' | 'onlineDisabled' | 'onlineCutoff';

export interface CatalogService extends QueueServiceItem {
  category: ServiceCategory;
}

export interface CatalogBarber {
  id: string;
  name: string;
  status: BarberAvailability;
}

export interface OperatingStatus {
  openTime: string;
  closeTime: string;
  cutoffTime: string;
  onlineJoiningEnabled: boolean;
  salonOpen: boolean;
  isOnlineJoiningOpen: boolean;
  reasonCode: SalonClosure | null;
  refreshAfterMs: number;
}

export interface PublicSalonStatus extends OperatingStatus {
  waitingCount: number;
  approxWaitMinutes: number | null;
  barberWaitMinutes: Record<string, number | null>;
}

export interface OwnerDashboard {
  date: string;
  settings: OperatingStatus;
  services: Array<CatalogService & { is_active: 0 | 1 }>;
  barbers: Array<CatalogBarber & { is_on_duty: 0 | 1; hasActiveAssignment: boolean }>;
  stats: Record<QueueStatus, number> & { averageWaitMinutes: number | null };
}
