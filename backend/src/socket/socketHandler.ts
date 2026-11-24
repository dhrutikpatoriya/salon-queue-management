import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let ioInstance: Server | null = null;

/**
 * Initializes and binds Socket.IO to the Node.js HTTP server.
 */
export function setupSocketIO(server: HttpServer): Server {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket: Socket) => {
    // console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      // console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  ioInstance = io;
  return io;
}

/**
 * Broadcasts a lightweight queue update event without any private customer data.
 * Clients securely re-fetch their own authoritative state using their private credentials.
 */
export function broadcastQueueUpdate() {
  if (ioInstance) {
    ioInstance.emit('queue:updated', {
      type: 'queue:updated',
      timestamp: Date.now()
    });
  }
}

export function getIO(): Server {
  if (!ioInstance) {
    throw new Error('Socket.IO has not been initialized yet. Call setupSocketIO first.');
  }
  return ioInstance;
}
