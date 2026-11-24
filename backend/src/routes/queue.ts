import { Router, Request, Response } from 'express';
import {
  joinCustomerQueue,
  getQueueTicket,
  cancelQueueTicket
} from '../services/queueService.js';
import { broadcastQueueUpdate } from '../socket/socketHandler.js';

export const queueRouter = Router();

// POST /api/queue/join - Joins queue or securely returns existing active spot without leaking access token
queueRouter.post('/join', (req: Request, res: Response) => {
  try {
    const { customerName, phoneNumber, serviceIds, barberPreference } = req.body;

    const result = joinCustomerQueue({
      customerName,
      phoneNumber,
      serviceIds,
      barberPreference
    });

    // Notify clients that queue has changed
    broadcastQueueUpdate();

    const isNewSpot = !result.isExisting;
    const providedToken =
      (req.headers['x-access-token'] as string) || (req.body && req.body.accessToken);
    const isAuthorizedOwner =
      isNewSpot || Boolean(providedToken && providedToken === result.ticket.access_token);

    return res.status(isNewSpot ? 201 : 200).json({
      success: true,
      isExistingSpot: result.isExisting,
      message: result.isExisting
        ? 'Active queue spot found for this phone number'
        : 'Successfully joined the queue',
      ticket: {
        id: result.ticket.id,
        tokenNumber: result.ticket.token_number,
        tokenDisplay: result.ticket.token_display,
        barberPreference: result.ticket.barber_preference,
        status: result.ticket.status,
        totalDurationMinutes: result.ticket.total_duration_minutes,
        totalPrice: result.ticket.total_price,
        services: result.services,
        // SECURITY REVIEW 1: Never leak access token or private customer details on duplicate phone queries
        accessToken: isAuthorizedOwner ? result.ticket.access_token : undefined,
        customerName: isAuthorizedOwner ? result.ticket.customer_name : undefined,
        phoneNumber: isAuthorizedOwner ? result.ticket.phone_number : undefined,
        isAuthorized: isAuthorizedOwner
      }
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Failed to join queue'
    });
  }
});

// GET /api/queue/:id - Securely gets ticket details and queue position
queueRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const ticketId = req.params.id;
    const accessToken = (req.headers['x-access-token'] as string) || (req.query.token as string);

    const ticket = getQueueTicket(ticketId, accessToken);
    return res.status(200).json({
      success: true,
      ticket
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Failed to fetch queue details'
    });
  }
});

// POST /api/queue/:id/cancel - Cancels active waiting spot (requires access token)
queueRouter.post('/:id/cancel', (req: Request, res: Response) => {
  try {
    const ticketId = req.params.id;
    const accessToken =
      (req.headers['x-access-token'] as string) || (req.body && req.body.accessToken);

    const cancelled = cancelQueueTicket(ticketId, accessToken);

    // Notify clients
    broadcastQueueUpdate();

    return res.status(200).json({
      success: true,
      message: 'Queue spot successfully cancelled',
      ticket: cancelled
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Failed to cancel queue spot'
    });
  }
});
