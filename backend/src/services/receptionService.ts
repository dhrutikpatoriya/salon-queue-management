import crypto from 'crypto';
import { db } from '../db/database.js';
import { getLocalTodayDate, isSalonOpen } from '../utils/timeUtils.js';
import { ServiceRecord, BarberRecord, QueueEntryRow } from './queueService.js';

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
  status: 'waiting' | 'called' | 'in_chair' | 'done' | 'cancelled' | 'no_show';
  totalDurationMinutes: number;
  totalPrice: number;
  services: ServiceRecord[];
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

/**
 * Retrieves full authoritative Reception Dashboard state for today.
 */
export function getReceptionDashboardData(): ReceptionDashboardData {
  const today = getLocalTodayDate();
  const salonCheck = isSalonOpen();
  const nowMs = Date.now();

  // 1. Fetch all barbers and their today's active assignments
  const rawBarbers = db.prepare(`SELECT * FROM barbers`).all() as BarberRecord[];

  const barbers: ReceptionBarberOverview[] = rawBarbers.map((b) => {
    if (b.is_on_duty === 0 || b.status === 'off_duty') {
      return {
        id: b.id,
        name: b.name,
        dutyStatus: 'off_duty',
        operationalState: 'off_duty',
        currentTicket: null
      };
    }

    if (b.status === 'break') {
      return {
        id: b.id,
        name: b.name,
        dutyStatus: 'on_duty',
        operationalState: 'break',
        currentTicket: null
      };
    }

    // Check active assigned ticket for today
    const active = db.prepare(`
      SELECT id, token_display, customer_name, status, called_at, started_at
      FROM queue_entries
      WHERE created_date = ? 
        AND assigned_barber_id = ?
        AND status IN ('called', 'in_chair')
      LIMIT 1
    `).get(today, b.id) as {
      id: string;
      token_display: string;
      customer_name: string;
      status: 'called' | 'in_chair';
      called_at: string | null;
      started_at: string | null;
    } | undefined;

    if (!active) {
      return {
        id: b.id,
        name: b.name,
        dutyStatus: 'on_duty',
        operationalState: b.status,
        currentTicket: null
      };
    }

    const baselineTime = active.status === 'in_chair' && active.started_at
      ? new Date(active.started_at).getTime()
      : active.called_at
      ? new Date(active.called_at).getTime()
      : nowMs;
    const elapsedMinutes = Math.max(0, Math.floor((nowMs - baselineTime) / 60000));

    return {
      id: b.id,
      name: b.name,
      dutyStatus: 'on_duty',
      // Mandatory Correction 3: Strictly distinguish Called from In Chair!
      operationalState: active.status === 'called' ? 'calling' : 'in_chair',
      currentTicket: {
        id: active.id,
        tokenDisplay: active.token_display,
        customerName: active.customer_name,
        status: active.status,
        calledAt: active.called_at,
        startedAt: active.started_at,
        elapsedMinutes
      }
    };
  });

  // 2. Fetch all queue tickets for today
  const tickets = db.prepare(`
    SELECT q.*, b.name as assigned_barber_name
    FROM queue_entries q
    LEFT JOIN barbers b ON q.assigned_barber_id = b.id
    WHERE q.created_date = ?
    ORDER BY q.token_number ASC
  `).all(today) as Array<QueueEntryRow & { assigned_barber_name: string | null; is_walk_in: number }>;

  // Calculate working barbers count for wait estimates
  const workingBarbers = barbers.filter(
    (b) => b.dutyStatus === 'on_duty' && b.operationalState !== 'break' && b.operationalState !== 'off_duty'
  ).length;

  let waitingAheadMinutes = 0;
  let waitingAheadCount = 0;

  const queue: ReceptionQueueItem[] = tickets.map((t) => {
    // Services for ticket
    const services = db.prepare(`
      SELECT s.id, s.name_en, s.name_gu, s.category, s.duration_minutes, s.price
      FROM services s
      JOIN queue_services qs ON s.id = qs.service_id
      WHERE qs.queue_id = ?
    `).all(t.id) as ServiceRecord[];

    let position = 0;
    let approxWaitMinutes: number | null = null;
    let isWaitUnavailable = false;

    if (t.status === 'waiting') {
      waitingAheadCount += 1;
      position = waitingAheadCount;

      if (workingBarbers === 0) {
        isWaitUnavailable = true;
        approxWaitMinutes = null;
      } else {
        approxWaitMinutes = Math.max(5, Math.ceil(waitingAheadMinutes / workingBarbers));
      }
      waitingAheadMinutes += t.total_duration_minutes;
    }

    // Grace period calculations for Called status (10-minute rule)
    let graceRemainingSeconds: number | null = null;
    let canMarkNoShow = false;

    if (t.status === 'called' && t.called_at) {
      const calledMs = new Date(t.called_at).getTime();
      const elapsedMs = nowMs - calledMs;
      const graceMs = 10 * 60 * 1000; // 10 minutes

      if (elapsedMs >= graceMs) {
        graceRemainingSeconds = 0;
        canMarkNoShow = true;
      } else {
        graceRemainingSeconds = Math.ceil((graceMs - elapsedMs) / 1000);
        canMarkNoShow = false;
      }
    }

    // Highlight waiting time exceeding 60 minutes in amber
    const isOver60MinWait =
      t.status === 'waiting' &&
      approxWaitMinutes !== null &&
      approxWaitMinutes > 60;

    return {
      id: t.id,
      tokenNumber: t.token_number,
      tokenDisplay: t.token_display,
      customerName: t.customer_name,
      phoneNumber: t.phone_number,
      isWalkIn: Boolean(t.is_walk_in),
      barberPreference: t.barber_preference,
      assignedBarber: t.assigned_barber_name,
      status: t.status,
      totalDurationMinutes: t.total_duration_minutes,
      totalPrice: t.total_price,
      services,
      position,
      approxWaitMinutes,
      isWaitUnavailable,
      isOver60MinWait,
      createdAt: t.created_at,
      calledAt: t.called_at,
      startedAt: t.started_at,
      completedAt: t.completed_at,
      cancelledAt: t.cancelled_at,
      graceRemainingSeconds,
      canMarkNoShow
    };
  });

  const stats = {
    totalToday: tickets.length,
    waitingCount: tickets.filter((t) => t.status === 'waiting').length,
    calledCount: tickets.filter((t) => t.status === 'called').length,
    inChairCount: tickets.filter((t) => t.status === 'in_chair').length,
    completedCount: tickets.filter((t) => t.status === 'done').length,
    noShowCount: tickets.filter((t) => t.status === 'no_show').length,
    cancelledCount: tickets.filter((t) => t.status === 'cancelled').length
  };

  return {
    salonOpen: salonCheck.open,
    salonMessage: salonCheck.reason,
    todayDate: today,
    barbers,
    queue,
    stats
  };
}

/**
 * Registers a walk-in customer into today's live queue at the end.
 * Allowed as long as the salon is open (until 9:00 PM).
 */
export function registerWalkInCustomer(input: {
  customerName: string;
  phoneNumber: string;
  serviceIds: string[];
  barberPreference: string;
}) {
  const salonCheck = isSalonOpen();
  if (!salonCheck.open) {
    const error: any = new Error(salonCheck.reason || 'Salon is currently closed');
    error.statusCode = 403;
    throw error;
  }

  const trimmedName = (input.customerName || '').trim();
  if (!trimmedName || trimmedName.length < 2) {
    const error: any = new Error('Customer name must be at least 2 characters long');
    error.statusCode = 400;
    throw error;
  }

  const cleanPhone = (input.phoneNumber || '').trim().replace(/\D/g, '');
  const indianPhoneRegex = /^[6-9]\d{9}$/;
  if (!cleanPhone || !indianPhoneRegex.test(cleanPhone)) {
    const error: any = new Error('Invalid phone number. Must be a 10-digit Indian mobile number');
    error.statusCode = 400;
    throw error;
  }

  const serviceIds = Array.isArray(input.serviceIds) ? input.serviceIds : [];
  if (serviceIds.length === 0 || serviceIds.length > 3) {
    const error: any = new Error('Please select between 1 and 3 services');
    error.statusCode = 400;
    throw error;
  }

  const placeholders = serviceIds.map(() => '?').join(',');
  const services = db.prepare(
    `SELECT * FROM services WHERE id IN (${placeholders}) AND is_active = 1`
  ).all(...serviceIds) as ServiceRecord[];

  if (services.length !== serviceIds.length) {
    const error: any = new Error('One or more selected services are invalid or inactive');
    error.statusCode = 400;
    throw error;
  }

  const barberPref = (input.barberPreference || 'any').trim().toLowerCase();
  if (barberPref !== 'any') {
    const barberCheck = db.prepare(`SELECT id, is_on_duty FROM barbers WHERE id = ?`).get(barberPref) as
      | { id: string; is_on_duty: number }
      | undefined;
    if (!barberCheck || barberCheck.is_on_duty === 0) {
      const error: any = new Error('Selected barber is not on duty');
      error.statusCode = 400;
      throw error;
    }
  }

  const totalDuration = services.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
  const todayDate = getLocalTodayDate();
  const nowIso = new Date().toISOString();

  // Atomic write transaction
  return db.transaction(() => {
    // Duplicate phone check for today
    const existing = db.prepare(`
      SELECT * FROM queue_entries
      WHERE phone_number = ? AND created_date = ? AND status IN ('waiting', 'called', 'in_chair')
      LIMIT 1
    `).get(cleanPhone, todayDate) as QueueEntryRow | undefined;

    if (existing) {
      return {
        ticket: existing,
        services,
        isExisting: true
      };
    }

    // Daily sequential token
    const nextRow = db.prepare(`
      SELECT COALESCE(MAX(token_number), 0) + 1 AS next_token
      FROM queue_entries
      WHERE created_date = ?
    `).get(todayDate) as { next_token: number };

    const tokenNumber = nextRow.next_token;
    const tokenDisplay = `S-${tokenNumber}`;
    const internalId = `q_walkin_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const accessToken = crypto.randomBytes(24).toString('hex');

    db.prepare(`
      INSERT INTO queue_entries (
        id, token_number, token_display, customer_name, phone_number,
        barber_preference, status, access_token, total_duration_minutes,
        total_price, is_walk_in, created_date, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, 'waiting', ?, ?,
        ?, 1, ?, ?
      )
    `).run(
      internalId,
      tokenNumber,
      tokenDisplay,
      trimmedName,
      cleanPhone,
      barberPref,
      accessToken,
      totalDuration,
      totalPrice,
      todayDate,
      nowIso
    );

    const insertServiceStmt = db.prepare(`
      INSERT INTO queue_services (queue_id, service_id, duration_minutes, price)
      VALUES (?, ?, ?, ?)
    `);
    for (const s of services) {
      insertServiceStmt.run(internalId, s.id, s.duration_minutes, s.price);
    }

    const createdTicket = db.prepare(`SELECT * FROM queue_entries WHERE id = ?`).get(internalId) as QueueEntryRow;

    return {
      ticket: createdTicket,
      services,
      isExisting: false
    };
  })();
}

/**
 * Mandatory Correction 2:
 * Atomically calls the earliest eligible Waiting customer for the selected available barber.
 * Performs barber availability check, customer eligibility selection, and atomic update in ONE transaction.
 */
export function callNextCustomerAtomic(barberId: string) {
  const today = getLocalTodayDate();
  const nowIso = new Date().toISOString();

  return db.transaction(() => {
    // 1. Verify barber duty and availability
    const barber = db.prepare(`SELECT * FROM barbers WHERE id = ?`).get(barberId) as BarberRecord | undefined;
    if (!barber || barber.is_on_duty !== 1) {
      const err: any = new Error('Barber is not on duty');
      err.statusCode = 400;
      throw err;
    }

    if (barber.status === 'break' || barber.status === 'off_duty') {
      const err: any = new Error(`Cannot call customer. Barber is currently ${barber.status}`);
      err.statusCode = 400;
      throw err;
    }

    // 2. Check if barber already has an active customer in called or in_chair
    const currentActive = db.prepare(`
      SELECT * FROM queue_entries
      WHERE created_date = ?
        AND assigned_barber_id = ?
        AND status IN ('called', 'in_chair')
      LIMIT 1
    `).get(today, barberId) as QueueEntryRow | undefined;

    if (currentActive) {
      const err: any = new Error(
        `Barber ${barber.name} is already reserved for ${currentActive.token_display} (${currentActive.status})`
      );
      err.statusCode = 400;
      throw err;
    }

    if (barber.status === 'busy') {
      const err: any = new Error('Cannot call customer. Barber is currently busy');
      err.statusCode = 400;
      throw err;
    }

    // 3. FCFS earliest eligible waiting customer query
    // Customers selecting Ravi must NEVER be assigned to Amit or Imran!
    // Customers selecting Any barber are eligible for this barber.
    const candidate = db.prepare(`
      SELECT * FROM queue_entries
      WHERE created_date = ?
        AND status = 'waiting'
        AND (barber_preference = ? OR barber_preference = 'any')
      ORDER BY token_number ASC
      LIMIT 1
    `).get(today, barberId) as QueueEntryRow | undefined;

    if (!candidate) {
      return {
        called: false,
        message: `No eligible waiting customers for ${barber.name}`,
        ticket: null,
        barber
      };
    }

    // 4. Atomically claim candidate
    const updateTicket = db.prepare(`
      UPDATE queue_entries
      SET status = 'called', assigned_barber_id = ?, called_at = ?
      WHERE id = ? AND status = 'waiting'
    `).run(barberId, nowIso, candidate.id);

    if (updateTicket.changes !== 1) {
      const err: any = new Error('Customer was just claimed by another action. Please try again.');
      err.statusCode = 409;
      throw err;
    }

    // 5. Update barber status to busy
    db.prepare(`UPDATE barbers SET status = 'busy' WHERE id = ?`).run(barberId);

    const updatedCandidate = db.prepare(`SELECT * FROM queue_entries WHERE id = ?`).get(candidate.id) as QueueEntryRow;

    return {
      called: true,
      message: `Called ${candidate.token_display} for ${barber.name}`,
      ticket: updatedCandidate,
      barber: { ...barber, status: 'busy' }
    };
  })();
}

/**
 * Receptionist cancellation of a waiting customer spot.
 */
export function receptionCancelTicket(ticketId: string) {
  const nowIso = new Date().toISOString();

  return db.transaction(() => {
    const ticket = db.prepare(`SELECT * FROM queue_entries WHERE id = ?`).get(ticketId) as QueueEntryRow | undefined;
    if (!ticket) {
      const err: any = new Error('Queue ticket not found');
      err.statusCode = 404;
      throw err;
    }

    if (ticket.status !== 'waiting') {
      const err: any = new Error(`Can only cancel tickets in 'waiting' status (current status: '${ticket.status}')`);
      err.statusCode = 400;
      throw err;
    }

    db.prepare(`
      UPDATE queue_entries
      SET status = 'cancelled', cancelled_at = ?
      WHERE id = ? AND status = 'waiting'
    `).run(nowIso, ticketId);

    return {
      id: ticket.id,
      tokenDisplay: ticket.token_display,
      status: 'cancelled',
      cancelledAt: nowIso
    };
  })();
}

/**
 * Marks a called customer as No-show only after the 10-minute grace period has passed.
 * Server-enforced: Rejects with 400 if less than 10 minutes have elapsed.
 */
export function markCustomerNoShow(ticketId: string) {
  const nowMs = Date.now();
  const GRACE_PERIOD_MS = 10 * 60 * 1000; // 10 minutes (600,000 ms)

  return db.transaction(() => {
    const ticket = db.prepare(`SELECT * FROM queue_entries WHERE id = ?`).get(ticketId) as QueueEntryRow | undefined;
    if (!ticket) {
      const err: any = new Error('Queue ticket not found');
      err.statusCode = 404;
      throw err;
    }

    if (ticket.status !== 'called') {
      const err: any = new Error(
        `Cannot mark as no-show. Only 'called' customers can be marked as no-show (current: '${ticket.status}')`
      );
      err.statusCode = 400;
      throw err;
    }

    if (!ticket.called_at) {
      const err: any = new Error('Ticket is missing called_at timestamp');
      err.statusCode = 400;
      throw err;
    }

    const calledTime = new Date(ticket.called_at).getTime();
    const elapsedMs = nowMs - calledTime;

    // Enforce 10-minute grace period
    if (elapsedMs < GRACE_PERIOD_MS) {
      const remainingSeconds = Math.ceil((GRACE_PERIOD_MS - elapsedMs) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      const err: any = new Error(
        `Cannot mark as no-show. 10-minute grace period has not elapsed yet (${remainingMinutes} minute(s) remaining)`
      );
      err.statusCode = 400;
      throw err;
    }

    // Update ticket to no_show
    db.prepare(`
      UPDATE queue_entries
      SET status = 'no_show'
      WHERE id = ? AND status = 'called'
    `).run(ticketId);

    // Free the assigned barber back to available
    if (ticket.assigned_barber_id) {
      db.prepare(`
        UPDATE barbers
        SET status = 'available'
        WHERE id = ? AND is_on_duty = 1 AND status = 'busy'
      `).run(ticket.assigned_barber_id);
    }

    return {
      id: ticket.id,
      tokenDisplay: ticket.token_display,
      status: 'no_show',
      freedBarberId: ticket.assigned_barber_id
    };
  })();
}
