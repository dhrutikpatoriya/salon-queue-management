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
