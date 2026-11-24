import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/database.js';
import { broadcastQueueUpdate } from '../socket/socketHandler.js';
import { isDevTestEnabled, matchesDevTestSecret } from '../utils/devSecurity.js';

export const devTestRouter = Router();

// Router-level strict security guard:
// Completely unavailable in production or when dev mode is not explicitly enabled
devTestRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!isDevTestEnabled()) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  next();
});

/**
 * Isolated development-only test endpoint to simulate a receptionist calling a customer.
 * Security Controls:
 * 1. Requires isDevTestEnabled() === true (never in production or when misconfigured)
 * 2. Bound strictly to localhost requests
 * 3. Protected by explicit dev test secret header
 * 4. Enforces barber eligibility rules
 */
devTestRouter.post('/call-customer/:id', (req: Request, res: Response) => {
  // 1. Localhost binding verification
  const remoteIp = req.socket.remoteAddress || '';
  const isLocal =
    remoteIp === '127.0.0.1' ||
    remoteIp === '::1' ||
    remoteIp === '::ffff:127.0.0.1';

  if (!isLocal) {
    return res.status(403).json({ error: 'Dev endpoints only accessible from localhost' });
  }

  // 2. Secret header verification
  if (!matchesDevTestSecret(req.headers['x-dev-test'])) {
    return res.status(403).json({ error: 'Unauthorized: Invalid dev test secret' });
  }

  const ticketId = req.params.id;
  const requestedBarber = (req.body && req.body.barberId) || 'ravi';

  try {
    const ticket = db.prepare(`SELECT * FROM queue_entries WHERE id = ?`).get(ticketId) as any;
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.status !== 'waiting') {
      return res.status(400).json({ error: `Cannot call ticket with status '${ticket.status}'` });
    }

    // 3. Barber eligibility check:
    // If customer selected a specific barber, ticket can ONLY be called for that barber!
    let assignedBarberId = requestedBarber;
    if (ticket.barber_preference !== 'any') {
      if (ticket.barber_preference !== requestedBarber) {
        return res.status(400).json({
          error: `Barber mismatch. Ticket prefers '${ticket.barber_preference}' but '${requestedBarber}' was requested`
        });
      }
      assignedBarberId = ticket.barber_preference;
    }

    const barber = db.prepare(`SELECT * FROM barbers WHERE id = ? AND is_on_duty = 1`).get(assignedBarberId) as any;
    if (!barber || barber.status === 'off_duty') {
      return res.status(400).json({ error: 'Assigned barber is off duty' });
    }

    const nowIso = new Date().toISOString();
    db.prepare(`
      UPDATE queue_entries 
      SET status = 'called', assigned_barber_id = ?, called_at = ? 
      WHERE id = ?
    `).run(assignedBarberId, nowIso, ticketId);

    // Notify all listening clients through Socket.IO without private customer data
    broadcastQueueUpdate();

    return res.status(200).json({
      success: true,
      message: `Ticket ${ticket.token_display} called for barber ${barber.name}`,
      ticket: {
        id: ticket.id,
        tokenDisplay: ticket.token_display,
        status: 'called',
        assignedBarber: barber.name,
        calledAt: nowIso
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
