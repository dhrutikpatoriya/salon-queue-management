import { Router, Request, Response } from 'express';
import {
  verifyPinAndCreateSession,
  requireStaffAuth,
  revokeStaffSession
} from '../middleware/staffAuth.js';
import {
  getReceptionDashboardData,
  registerWalkInCustomer,
  callNextCustomerAtomic,
  receptionCancelTicket,
  markCustomerNoShow
} from '../services/receptionService.js';
import { broadcastQueueUpdate } from '../socket/socketHandler.js';

export const receptionRouter = Router();

// POST /api/reception/login - Rate-limited, server-verified staff PIN login
receptionRouter.post('/login', (req: Request, res: Response) => {
  const { pin } = req.body;
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

  const result = verifyPinAndCreateSession(pin, ip);
  if (!result.success) {
    return res.status(result.status).json({
      success: false,
      error: result.error
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Staff authentication successful',
    token: result.token,
    expiresAt: result.expiresAt
  });
});

// POST /api/reception/logout - Revokes staff session token
receptionRouter.post('/logout', requireStaffAuth, (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req.headers['x-staff-token'] as string);

  if (token) {
    revokeStaffSession(token);
  }

  return res.status(200).json({
    success: true,
    message: 'Staff session successfully ended'
  });
});

// GET /api/reception/session - Verifies active session token
receptionRouter.get('/session', requireStaffAuth, (req: Request, res: Response) => {
  const session = (req as any).staffSession;
  return res.status(200).json({
    success: true,
    valid: true,
    expiresAt: session?.expiresAt
  });
});

// GET /api/reception/dashboard - Full live reception dashboard data
receptionRouter.get('/dashboard', requireStaffAuth, (req: Request, res: Response) => {
  try {
    const data = getReceptionDashboardData();
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to fetch reception dashboard'
    });
  }
});

// POST /api/reception/walk-in - Registers in-person walk-in customer into same queue
receptionRouter.post('/walk-in', requireStaffAuth, (req: Request, res: Response) => {
  try {
    const { customerName, phoneNumber, serviceIds, barberPreference } = req.body;
    const result = registerWalkInCustomer({
      customerName,
      phoneNumber,
      serviceIds,
      barberPreference
    });

    // Notify all connected devices
    broadcastQueueUpdate();

    return res.status(result.isExisting ? 200 : 201).json({
      success: true,
      message: result.isExisting
        ? 'Customer already has an active queue spot for today'
        : 'Walk-in customer successfully registered',
      isExistingSpot: result.isExisting,
      ticket: {
        id: result.ticket.id,
        tokenNumber: result.ticket.token_number,
        tokenDisplay: result.ticket.token_display,
        customerName: result.ticket.customer_name,
        phoneNumber: result.ticket.phone_number,
        isWalkIn: true,
        barberPreference: result.ticket.barber_preference,
        status: result.ticket.status,
        totalDurationMinutes: result.ticket.total_duration_minutes,
        totalPrice: result.ticket.total_price,
        services: result.services
      }
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to register walk-in customer'
    });
  }
});

// POST /api/reception/call-next - Atomically calls next eligible customer for barber
receptionRouter.post('/call-next', requireStaffAuth, (req: Request, res: Response) => {
  try {
    const { barberId } = req.body;
    if (!barberId) {
      return res.status(400).json({ success: false, error: 'barberId is required' });
    }

    const result = callNextCustomerAtomic(barberId);

    if (result.called) {
      broadcastQueueUpdate();
    }

    return res.status(200).json({
      success: true,
      called: result.called,
      message: result.message,
      ticket: result.ticket
        ? {
            id: result.ticket.id,
            tokenDisplay: result.ticket.token_display,
            customerName: result.ticket.customer_name,
            status: result.ticket.status,
            assignedBarber: result.barber.name,
            calledAt: result.ticket.called_at
          }
        : null,
      barber: result.barber
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to call next customer'
    });
  }
});

// POST /api/reception/cancel/:id - Receptionist cancels waiting spot
receptionRouter.post('/cancel/:id', requireStaffAuth, (req: Request, res: Response) => {
  try {
    const result = receptionCancelTicket(req.params.id);
    broadcastQueueUpdate();

    return res.status(200).json({
      success: true,
      message: `Queue spot ${result.tokenDisplay} cancelled`,
      ticket: result
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to cancel queue ticket'
    });
  }
});

// POST /api/reception/no-show/:id - Marks customer as no-show after 10-minute grace period
receptionRouter.post('/no-show/:id', requireStaffAuth, (req: Request, res: Response) => {
  try {
    const result = markCustomerNoShow(req.params.id);
    broadcastQueueUpdate();

    return res.status(200).json({
      success: true,
      message: `Customer ${result.tokenDisplay} marked as no-show`,
      ticket: result
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to mark as no-show'
    });
  }
});
