import crypto from 'crypto';
import { db } from '../db/database.js';
import { getLocalTodayDate, isOnlineJoiningAllowed } from '../utils/timeUtils.js';

export interface JoinQueueInput {
  customerName: string;
  phoneNumber: string;
  serviceIds: string[];
  barberPreference: string;
}

export interface ServiceRecord {
  id: string;
  name_en: string;
  name_gu: string;
  category: string;
  duration_minutes: number;
  price: number;
}

export interface BarberRecord {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'break' | 'off_duty';
  is_on_duty: number;
}

export interface QueueEntryRow {
  id: string;
  token_number: number;
  token_display: string;
  customer_name: string;
  phone_number: string;
  barber_preference: string;
  assigned_barber_id: string | null;
  status: 'waiting' | 'called' | 'in_chair' | 'done' | 'cancelled' | 'no_show';
  access_token: string;
  total_duration_minutes: number;
  total_price: number;
  created_date: string;
  created_at: string;
  called_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

/**
 * Validates and atomically creates or retrieves a customer's queue ticket.
 */
export function joinCustomerQueue(input: JoinQueueInput): {
  ticket: QueueEntryRow;
  services: ServiceRecord[];
  isExisting: boolean;
} {
  // 1. Check operating hours & online joining availability
  const hoursCheck = isOnlineJoiningAllowed();
  if (!hoursCheck.allowed) {
    const error: any = new Error(hoursCheck.reason || 'Online joining is currently closed');
    error.statusCode = 403;
    throw error;
  }

  // 2. Validate Customer Name
  const trimmedName = (input.customerName || '').trim();
  if (!trimmedName || trimmedName.length < 2) {
    const error: any = new Error('Customer name must be at least 2 characters long');
    error.statusCode = 400;
    throw error;
  }

  // 3. Validate Indian Phone Number (10 digits starting with 6, 7, 8, or 9)
  const cleanPhone = (input.phoneNumber || '').trim().replace(/\D/g, '');
  const indianPhoneRegex = /^[6-9]\d{9}$/;
  if (!cleanPhone || !indianPhoneRegex.test(cleanPhone)) {
    const error: any = new Error('Invalid phone number. Must be a 10-digit Indian mobile number');
    error.statusCode = 400;
    throw error;
  }

  // 4. Validate Services count (1 to 3 services)
  const serviceIds = Array.isArray(input.serviceIds) ? input.serviceIds : [];
  if (serviceIds.length === 0) {
    const error: any = new Error('At least 1 service must be selected');
    error.statusCode = 400;
    throw error;
  }
  if (serviceIds.length > 3) {
    const error: any = new Error('A maximum of 3 services can be selected');
    error.statusCode = 400;
    throw error;
  }

  // 5. Fetch authoritative service records from SQLite
  const placeholders = serviceIds.map(() => '?').join(',');
  const services = db.prepare(
    `SELECT * FROM services WHERE id IN (${placeholders}) AND is_active = 1`
  ).all(...serviceIds) as ServiceRecord[];

  if (services.length !== serviceIds.length) {
    const error: any = new Error('One or more selected services are invalid or inactive');
    error.statusCode = 400;
    throw error;
  }

  // 6. Validate Barber Preference
  const barberPref = (input.barberPreference || 'any').toLowerCase().trim();
  if (barberPref !== 'any') {
    const barber = db.prepare(
      `SELECT * FROM barbers WHERE id = ? AND is_on_duty = 1`
    ).get(barberPref) as BarberRecord | undefined;
    if (!barber) {
      const error: any = new Error('Selected barber is not on duty or invalid');
      error.statusCode = 400;
      throw error;
    }
  }

  // Authoritatively calculate total duration and price
  const totalDuration = services.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);

  const todayDate = getLocalTodayDate();
  const nowIso = new Date().toISOString();

  // 7. Atomic transaction with partial unique index check and sequential token generation
  const runAtomicJoin = db.transaction(() => {
    // Check for existing active spot for this phone number on today's date
    const existingTicket = db.prepare(`
      SELECT * FROM queue_entries 
      WHERE phone_number = ? AND created_date = ? AND status IN ('waiting', 'called', 'in_chair')
      LIMIT 1
    `).get(cleanPhone, todayDate) as QueueEntryRow | undefined;

    if (existingTicket) {
      const ticketServices = db.prepare(`
        SELECT s.* FROM services s
        JOIN queue_services qs ON s.id = qs.service_id
        WHERE qs.queue_id = ?
      `).all(existingTicket.id) as ServiceRecord[];

      return {
        ticket: existingTicket,
        services: ticketServices,
        isExisting: true
      };
    }

    // Calculate sequential daily token starting from 1
    const nextTokenRow = db.prepare(`
      SELECT COALESCE(MAX(token_number), 0) + 1 AS next_token 
      FROM queue_entries 
      WHERE created_date = ?
    `).get(todayDate) as { next_token: number };

    const tokenNumber = nextTokenRow.next_token;
    const tokenDisplay = `S-${tokenNumber}`;
    const internalId = `q_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const accessToken = crypto.randomBytes(24).toString('hex');

    // Insert queue ticket with UNIQUE(created_date, token_number) constraint
    db.prepare(`
      INSERT INTO queue_entries (
        id, token_number, token_display, customer_name, phone_number,
        barber_preference, status, access_token, total_duration_minutes,
        total_price, created_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?, ?, ?)
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

    // Insert junction services
    const insertJunction = db.prepare(`
      INSERT INTO queue_services (queue_id, service_id, duration_minutes, price)
      VALUES (?, ?, ?, ?)
    `);

    for (const s of services) {
      insertJunction.run(internalId, s.id, s.duration_minutes, s.price);
    }

    const createdTicket = db.prepare(
      `SELECT * FROM queue_entries WHERE id = ?`
    ).get(internalId) as QueueEntryRow;

    return {
      ticket: createdTicket,
      services,
      isExisting: false
    };
  });

  return runAtomicJoin();
}

/**
 * Calculates FCFS queue position and approximate waiting time according to docs/03-flows-rules.md.
 */
export function calculateQueuePositionAndTime(ticket: Pick<QueueEntryRow, 'status' | 'created_date' | 'created_at' | 'barber_preference'>): {
  position: number;
  approxWaitMinutes: number | null;
  isWaitUnavailable: boolean;
  waitReason?: string;
  eligibleCustomersAhead: number;
  workingBarbersCount: number;
} {
  if (ticket.status !== 'waiting') {
    return {
      position: 0,
      approxWaitMinutes: 0,
      isWaitUnavailable: false,
      eligibleCustomersAhead: 0,
      workingBarbersCount: 0
    };
  }

  const todayDate = ticket.created_date;

  // Fetch all active waiting tickets that joined today before this ticket
  const allWaitingAhead = db.prepare(`
    SELECT id, barber_preference, total_duration_minutes, created_at
    FROM queue_entries
    WHERE created_date = ? AND status = 'waiting' AND created_at < ?
    ORDER BY created_at ASC, token_number ASC
  `).all(todayDate, ticket.created_at) as Array<{
    id: string;
    barber_preference: string;
    total_duration_minutes: number;
    created_at: string;
  }>;

  // Fetch on-duty barbers
  const onDutyBarbers = db.prepare(`
    SELECT * FROM barbers WHERE is_on_duty = 1
  `).all() as BarberRecord[];

  let eligibleAhead: typeof allWaitingAhead = [];
  let workingBarbersCount = 0;

  if (ticket.barber_preference === 'any') {
    // For Any Barber: all waiting customers ahead count
    eligibleAhead = allWaitingAhead;
    // Working barbers are on-duty barbers who are NOT on break
    workingBarbersCount = onDutyBarbers.filter(
      (b) => b.status === 'available' || b.status === 'busy'
    ).length;
  } else {
    // For Specific Barber: only customers ahead who chose this specific barber OR chose Any Barber
    const pref = ticket.barber_preference;
    eligibleAhead = allWaitingAhead.filter(
      (t) => t.barber_preference === pref || t.barber_preference === 'any'
    );

    // Working barbers count for this specific queue is 1 if that barber is available or busy, 0 if on break/off-duty
    const specificBarber = onDutyBarbers.find((b) => b.id === pref);
    if (specificBarber && (specificBarber.status === 'available' || specificBarber.status === 'busy')) {
      workingBarbersCount = 1;
    } else {
      workingBarbersCount = 0;
    }
  }

  const position = eligibleAhead.length + 1;

  // Mandatory Correction 3:
  // When no eligible barber is working, return unavailable wait estimate rather than dividing by 1!
  if (workingBarbersCount === 0) {
    return {
      position,
      approxWaitMinutes: null,
      isWaitUnavailable: true,
      waitReason: ticket.barber_preference === 'any'
        ? 'All barbers are currently on break'
        : 'Your selected barber is currently on break',
      eligibleCustomersAhead: eligibleAhead.length,
      workingBarbersCount: 0
    };
  }

  // Sum duration of eligible customers ahead
  const minutesAhead = eligibleAhead.reduce((sum, t) => sum + t.total_duration_minutes, 0);

  // Approximation formula: sum of service minutes ahead / working barbers
  const approxWaitMinutes = Math.max(5, Math.ceil(minutesAhead / workingBarbersCount));

  return {
    position,
    approxWaitMinutes,
    isWaitUnavailable: false,
    eligibleCustomersAhead: eligibleAhead.length,
    workingBarbersCount
  };
}

/**
 * Securely retrieves queue ticket details.
 * If accessToken matches, provides full private info. If not, provides safe public tracking fields.
 */
export function getQueueTicket(ticketId: string, accessToken?: string) {
  const ticket = db.prepare(`SELECT * FROM queue_entries WHERE id = ?`).get(ticketId) as
    | QueueEntryRow
    | undefined;

  if (!ticket) {
    const error: any = new Error('Queue ticket not found');
    error.statusCode = 404;
    throw error;
  }

  const services = db.prepare(`
    SELECT s.id, s.name_en, s.name_gu, s.duration_minutes, s.price, s.category
    FROM services s
    JOIN queue_services qs ON s.id = qs.service_id
    WHERE qs.queue_id = ?
  `).all(ticket.id) as ServiceRecord[];

  const assignedBarber = ticket.assigned_barber_id
    ? (db.prepare(`SELECT id, name FROM barbers WHERE id = ?`).get(ticket.assigned_barber_id) as
        | { id: string; name: string }
        | undefined)
    : null;

  const calculations = calculateQueuePositionAndTime(ticket);
  const isAuthorized = Boolean(accessToken && accessToken === ticket.access_token);

  return {
    id: ticket.id,
    tokenNumber: ticket.token_number,
    tokenDisplay: ticket.token_display,
    status: ticket.status,
    barberPreference: ticket.barber_preference,
    assignedBarber: assignedBarber ? assignedBarber.name : null,
    totalDurationMinutes: ticket.total_duration_minutes,
    totalPrice: ticket.total_price,
    services,
    position: calculations.position,
    approxWaitMinutes: calculations.approxWaitMinutes,
    isWaitUnavailable: calculations.isWaitUnavailable,
    waitReason: calculations.waitReason,
    shouldStartComing: calculations.position === 2,
    isYourTurn: ticket.status === 'called',
    createdAt: ticket.created_at,
    calledAt: ticket.called_at,
    // Only return private details if authorized
    customerName: isAuthorized ? ticket.customer_name : undefined,
    phoneNumber: isAuthorized ? ticket.phone_number : undefined,
    isAuthorized
  };
}

/**
 * Cancels an active ticket with mandatory security verification.
 * Only permitted while status is 'waiting'.
 */
export function cancelQueueTicket(ticketId: string, accessToken: string) {
  if (!accessToken) {
    const error: any = new Error('Customer access token is required to cancel spot');
    error.statusCode = 401;
    throw error;
  }

  const ticket = db.prepare(`SELECT * FROM queue_entries WHERE id = ?`).get(ticketId) as
    | QueueEntryRow
    | undefined;

  if (!ticket) {
    const error: any = new Error('Queue ticket not found');
    error.statusCode = 404;
    throw error;
  }

  // Verify access token
  if (ticket.access_token !== accessToken) {
    const error: any = new Error('Unauthorized: Invalid customer access credential');
    error.statusCode = 403;
    throw error;
  }

  // Verify status transition rule: Only Waiting tickets can be cancelled
  if (ticket.status !== 'waiting') {
    const error: any = new Error(
      `Cancellation not permitted. Current status is '${ticket.status}' (can only cancel while waiting)`
    );
    error.statusCode = 400;
    throw error;
  }

  const nowIso = new Date().toISOString();
  db.prepare(`
    UPDATE queue_entries 
    SET status = 'cancelled', cancelled_at = ? 
    WHERE id = ?
  `).run(nowIso, ticketId);

  return {
    id: ticket.id,
    tokenDisplay: ticket.token_display,
    status: 'cancelled',
    cancelledAt: nowIso
  };
}
