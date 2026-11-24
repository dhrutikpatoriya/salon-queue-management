import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let ioInstance: Server | null = null;

/**
 * Initializes and binds Socket.IO to the Node.js HTTP server.
 * Configured with permissive CORS for local development across Vite ports.
 */
export function setupSocketIO(server: HttpServer): Server {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  ioInstance = io;
  return io;
}

/**
 * Returns the active Socket.IO server instance for broadcasting events.
 */
export function getIO(): Server {
  if (!ioInstance) {
    throw new Error('Socket.IO has not been initialized yet. Call setupSocketIO first.');
  }
  return ioInstance;
}
